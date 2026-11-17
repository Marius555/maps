import { fail, ok } from "@/lib/api/responses";
import { parseBody, withPersonalAuth } from "@/lib/api/route";
import {
  BillingError,
  getBilling,
  type KeptPlan,
  type SubscriptionDetails,
} from "@/lib/billing";
import { planChange } from "@/lib/billing/plan-change";
import { refuseShopifyBilled } from "@/lib/billing/shopify-billed";
import { billingStanding } from "@/lib/billing/standing";
import { ownWorkspace } from "@/lib/repositories/context";
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
 * **An upgrade starts now; a downgrade starts at the renewal**, booked at the
 * provider — see `planChange`. "Keep …" lets a booked downgrade go.
 *
 * Only a `switchable` subscription may be moved — `billingStanding`, which the
 * account page asks too, so the button and the route cannot disagree. A
 * `past_due` or `paused` one is something the provider is still deciding about,
 * and the page sends those to the portal rather than guessing.
 *
 * **The row is written here as well as by the webhook**, from the provider's own
 * reply, so the page shows the change on its next render instead of waiting for
 * an event that has no promised arrival time. `upsertSubscription` is
 * idempotent, so the webhook landing afterwards rewrites the same values.
 *
 * The reply's `kept` describes a booked downgrade the way the page's toast
 * reads it: the plan paid for, kept until the date the change takes effect.
 */
export const PATCH = withPersonalAuth(async ({ request, user }) => {
  const input = await parseBody(request, changePlanSchema);
  const subscription = await getSubscription(ownWorkspace(user.id));

  const shopify = refuseShopifyBilled(subscription);
  if (shopify) return shopify;

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
   * Read live, for two things our row cannot hold: whether the subscription is
   * set to end (still `active` in the row, correctly) and which downgrade, if
   * any, is booked for the renewal. Unlike before, a failed read refuses the
   * change: without knowing what is booked, the decision below could be wrong.
   */
  let live: SubscriptionDetails | null;

  try {
    live = await getBilling().subscriptionDetails(subscription.billingSubscriptionId);
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    return fail("internal_error", error.message, 502);
  }

  if (live?.cancelled) {
    return fail(
      "conflict",
      "Your plan is set to end. Resume it first, then change plans.",
      409,
    );
  }

  const change = planChange(
    { plan: subscription.plan, cadence: subscription.cadence },
    input,
    live?.scheduled ?? null,
  );

  if (change.kind === "unchanged") {
    return fail(
      "conflict",
      change.booked ? "That change is already booked for your renewal." : "You're already on that plan.",
      409,
    );
  }

  let details: SubscriptionDetails | null;

  try {
    details =
      change.kind === "keep"
        ? await getBilling().keepPlan(subscription.billingSubscriptionId)
        : await getBilling().changePlan({
            billingSubscriptionId: subscription.billingSubscriptionId,
            ...change.target,
            when: change.kind,
          });
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    // A 502 rather than the wrapper's generic 500: the refusal is upstream, and
    // `BillingError`'s own text is written to be read by the customer.
    return fail("internal_error", error.message, 502);
  }

  const state = details?.state ?? null;

  if (!state) {
    /*
     * The provider accepted the change and answered with a price that is none
     * of ours — the store and our lookup keys disagree. The change *has*
     * happened on their side, so this is logged loudly.
     */
    console.error(`Plan change for ${user.id} returned a price no pinglide_* lookup key matches.`);

    return fail(
      "internal_error",
      "The change went through, but we couldn't read the new plan back. Refresh in a minute.",
      502,
    );
  }

  await upsertSubscription({ ...state, userId: user.id });

  const booked = details?.scheduled ?? null;
  const kept: KeptPlan | null =
    change.kind === "renewal" && booked
      ? { plan: state.plan === "free" ? "starter" : state.plan, cadence: state.cadence, until: booked.at }
      : null;

  return ok({
    plan: booked && change.kind === "renewal" ? booked.plan : state.plan,
    cadence: booked && change.kind === "renewal" ? booked.cadence : state.cadence,
    kept,
  });
}, { rateLimit: "billing" });

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
 * reads as `active` until `cancel_at`: the set-to-cancel → `active` mapping in
 * `lib/billing/stripe.ts` is what keeps the plan they paid for until then.
 */
export const DELETE = withPersonalAuth(async ({ user }) => {
  const subscription = await getSubscription(ownWorkspace(user.id));

  const shopify = refuseShopifyBilled(subscription);
  if (shopify) return shopify;

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
}, { rateLimit: "billing" });
