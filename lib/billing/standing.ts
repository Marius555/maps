import type { SubscriptionState } from "./types";

/**
 * What the account page may offer a subscription, decided once.
 *
 * - **`switchable`** — running, and moved in place by `PATCH
 *   /api/account/subscription`. A second checkout here would be a second
 *   subscription and a second charge.
 * - **`held`** — past due or paused. The provider is in the middle of deciding
 *   about it, so the page points at the portal and offers no switch.
 * - **`none`** — nothing to move: never bought, ended, or lapsed. A plan is
 *   bought fresh through `/upgrade`.
 *
 * Pure and outside the repositories so it can be tested without a database, and
 * so the page and the route cannot disagree about which subscriptions are
 * movable. It reads the row, **not** `getUserPlan` — that one answers "pro" for
 * everybody under `DISABLE_ALL_PLAN`, and a page that took its billing controls
 * from it would offer a developer a switch away from a plan they never bought.
 */
export type BillingStanding = "none" | "switchable" | "held";

type Row = Pick<
  SubscriptionState,
  "plan" | "status" | "billingSubscriptionId" | "currentPeriodEnd"
>;

export function billingStanding(
  subscription: Row | null,
  now: number = Date.now(),
): BillingStanding {
  if (!subscription?.billingSubscriptionId) return "none";

  const { status } = subscription;

  if (status === "past_due" || status === "paused") return "held";

  if (
    (status === "active" || status === "trialing") &&
    subscription.plan !== "free" &&
    !hasLapsed(subscription.currentPeriodEnd, now)
  ) {
    return "switchable";
  }

  return "none";
}

/**
 * Whether a period end has passed. An unparseable date is read as *not* lapsed,
 * for the reason every uncertain DNS answer in `lib/email/mx.ts` is read as a
 * yes: a value we cannot understand must not lock a paying customer out of the
 * thing they are paying for.
 *
 * Lives here, pure, so `getUserPlan` and `billingStanding` share one reading of
 * the date rather than two that agree today.
 */
export function hasLapsed(
  currentPeriodEnd: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!currentPeriodEnd) return false;

  const endsAt = Date.parse(currentPeriodEnd);

  return Number.isFinite(endsAt) && endsAt < now;
}
