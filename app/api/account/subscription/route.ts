import { fail, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  BillingError,
  getBilling,
  type KeptPlan,
  type SubscriptionDetails,
  type SubscriptionState,
} from "@/lib/billing";
import { pendingKept, planChange } from "@/lib/billing/plan-change";
import { billingStanding } from "@/lib/billing/standing";
import {
  getSubscription,
  upsertSubscription,
} from "@/lib/repositories/subscriptions.repository";
import { changePlanSchema } from "@/lib/validation/billing.schema";

/**
 * Move this account's running subscription to another plan or cadence.
 *
 * **This is the path for somebody who already pays, and `/upgrade` is not.**
 * `/upgrade` opens a fresh checkout, which for an existing subscriber is a
 * *second* subscription beside the first — two charges for one account. So the
 * account page sends a free account to `/upgrade` and a paying one here, where
 * the subscription they have is changed in place.
 *
 * **An upgrade starts now; a downgrade starts at the renewal.** How, and why the
 * provider is moved at once either way, is `planChange`'s docblock — this route
 * carries out what it decides and writes the answer down.
 *
 * Only a `switchable` subscription may be moved — `billingStanding`, which the
 * account page asks too, so the button and the route cannot disagree. A
 * `past_due` or `paused` one is something the provider is still deciding about,
 * and the page sends those to the portal rather than guessing.
 *
 * **The row is written here as well as by the webhook**, from the provider's own
 * reply, so the page shows the change on its next render instead of waiting for
 * an event that has no promised arrival time. Both go through `toState` and
 * `upsertSubscription` is idempotent, so the webhook landing afterwards rewrites
 * the same values rather than racing them — and it never touches the kept plan,
 * which only this route writes.
 */
export const PATCH = withAuth(async ({ request, user }) => {
  const input = await parseBody(request, changePlanSchema);
  const subscription = await getSubscription(user.id);

  const standing = billingStanding(subscription);

  if (!subscription || standing === "none") {
    return fail(
      "conflict",
      "There's no running subscription on this account to change. Choose a plan to start one.",
      409,
    );
  }

  if (standing === "held") {
    return fail(
      "conflict",
      "This subscription can't be changed right now. Update your card under Payment first, then try again.",
      409,
    );
  }

  /*
   * A cancelled subscription is still `active` in our row — correctly, it runs
   * to the end of what was paid for — so the standing above cannot see it. The
   * provider can: ask once, and refuse, because moving a subscription that is
   * about to end would bill a plan change nobody will use. A read that fails
   * lets the change through; the provider still has the last word on it.
   */
  const live = await getBilling()
    .subscriptionDetails(subscription.billingSubscriptionId)
    .catch(() => null);

  if (live?.cancelled) {
    return fail(
      "conflict",
      "Your plan is set to end. Resume it first, then change plans.",
      409,
    );
  }

  const change = planChange(subscription, input);

  if (change.kind === "unchanged") {
    return fail(
      "conflict",
      pendingKept(subscription)
        ? "That change is already booked for your renewal."
        : "You're already on that plan.",
      409,
    );
  }

  let state: Omit<SubscriptionState, "userId"> | null = null;

  try {
    /*
     * One step, or two when an upgrade first has to undo a pending downgrade.
     * If the second fails after the first succeeded, the subscription is back on
     * the plan that was paid for and nothing is pending — so that state is
     * written before the error is returned, rather than left for the webhook.
     */
    for (const [index, step] of change.steps.entries()) {
      try {
        state = await getBilling().changePlan({
          billingSubscriptionId: subscription.billingSubscriptionId,
          ...step,
        });
      } catch (error) {
        if (index > 0 && state) await upsertSubscription({ ...state, userId: user.id }, null);

        throw error;
      }
    }
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    // A 502 rather than the wrapper's generic 500: the refusal is upstream, and
    // `BillingError`'s own text is written to be read by the customer.
    return fail("internal_error", error.message, 502);
  }

  if (!state) {
    /*
     * The provider accepted the change and answered with a variant that is none
     * of ours — the environment and the store disagree. The change *has*
     * happened on their side, so this is logged loudly, and the webhook will
     * decline the same event for the same reason.
     */
    console.error(
      `Plan change for ${user.id} returned a variant no LEMON_VARIANT_* matches.`,
    );

    return fail(
      "internal_error",
      "The change went through, but we couldn't read the new plan back. Refresh in a minute.",
      502,
    );
  }

  /*
   * A downgrade keeps what was paid for until the renewal the provider has just
   * answered with. With no date at all there is nothing to keep it until, so the
   * change simply stands — logged, because it means the customer lost the rest
   * of a period they paid for.
   */
  const until = change.keep ? (change.keep.until ?? state.currentPeriodEnd) : null;
  const kept: KeptPlan | null = change.keep && until ? { ...change.keep, until } : null;

  if (change.keep && !until) {
    console.error(`Downgrade for ${user.id} has no renewal date, so nothing was kept.`);
  }

  await upsertSubscription({ ...state, userId: user.id }, kept);

  return ok({ plan: state.plan, cadence: state.cadence, kept });
});

/**
 * Cancel: stop the renewal, keep the plan until the period paid for ends.
 *
 * **In the app now, where it used to be the portal's alone.** The provider
 * still does all of it — this is one call to its own cancel, and the invoice,
 * the proration and the end date are all its decisions. What changed is that a
 * customer no longer has to leave the dashboard and find the button on somebody
 * else's site to stop paying us, which is the kind of friction that ends in a
 * chargeback rather than a cancellation.
 *
 * A past-due subscription may be cancelled too — somebody whose card failed and
 * who wants to stop is the last person to send round a portal. Only an account
 * with nothing running is refused.
 *
 * The reply is written through `toState` like every other write to the row, and
 * reads as `active` until `ends_at`: the `cancelled → active` mapping in
 * `lib/billing/lemon.ts` is what keeps the plan they paid for until then.
 */
export const DELETE = withAuth(async ({ user }) => {
  const subscription = await getSubscription(user.id);

  if (!subscription?.billingSubscriptionId || billingStanding(subscription) === "none") {
    return fail("conflict", "There's no running plan on this account to cancel.", 409);
  }

  let details: SubscriptionDetails | null;

  try {
    details = await getBilling().cancelSubscription(subscription.billingSubscriptionId);
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    return fail("internal_error", error.message, 502);
  }

  if (details?.state) await upsertSubscription({ ...details.state, userId: user.id });

  return ok({ endsAt: details?.endsAt ?? details?.state?.currentPeriodEnd ?? null });
});
