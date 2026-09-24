import { fail, ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { BillingError, getBilling, type SubscriptionDetails } from "@/lib/billing";
import { billingStanding } from "@/lib/billing/standing";
import {
  getSubscription,
  upsertSubscription,
} from "@/lib/repositories/subscriptions.repository";

/**
 * Resume: undo a cancellation before the period it ends at.
 *
 * Only while the subscription is still running. Once it has lapsed, `billingStanding`
 * reads it as `none` and there is nothing left to resume — a plan is bought
 * fresh through `/upgrade`, which is what the refusal says.
 *
 * POST rather than a PATCH on `../route.ts`, whose PATCH is the plan change: two
 * different requests for two different presses, validated two different ways.
 */
export const POST = withAuth(async ({ user }) => {
  const subscription = await getSubscription(user.id);

  if (!subscription?.billingSubscriptionId || billingStanding(subscription) === "none") {
    return fail(
      "conflict",
      "This plan has already ended, so there's nothing to resume. Choose a plan to start again.",
      409,
    );
  }

  let details: SubscriptionDetails | null;

  try {
    details = await getBilling().resumeSubscription(subscription.billingSubscriptionId);
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    return fail("internal_error", error.message, 502);
  }

  if (details?.state) await upsertSubscription({ ...details.state, userId: user.id });

  return ok({ renewsAt: details?.renewsAt ?? null });
});
