import type { BillingCadence, PaidPlanId, SubscriptionState } from "./types";

/**
 * Shopify App Pricing's answer about a shop, mapped onto ours.
 *
 * The Shopify twin of `toState` in `lemon.ts`, and pure for the same reason:
 * every judgement about what a provider's state *means* lives in one tested
 * function (docs/notes/billing.md). Shopify reports a plan only through the
 * Partner API's `activeSubscription` — it stopped sending subscription webhooks
 * for App Pricing on 2026-04-28 — so `lib/shopify/plan-sync.ts` asks, and this
 * decides.
 *
 * The plans are defined in the Partner Dashboard with the handles `free`,
 * `starter` and `pro`, each sold monthly and yearly (docs/notes/shopify.md).
 */

/** The fields of the Partner API's `ActiveSubscription` this reads. */
export type ShopifyActiveSubscription = {
  /** `EVERY_30_DAYS` or `ANNUAL` (`AppPricingInterval`). */
  billingPeriod: string;
  cancelAtEndOfCycle: boolean;
  trialEndsAt: string | null;
  /** Null while the subscription is still in its trial. */
  currentBillingCycle: { startTime: string; endTime: string } | null;
  items: { handle: string }[];
};

/**
 * How long past the end of a billing cycle a renewing Shopify plan keeps
 * granting itself.
 *
 * `getUserPlan` ends a plan at `currentPeriodEnd`, which is the safety net for a
 * lost webhook on the Lemon side. Shopify sends us nothing at a renewal, so the
 * end date only moves when the hourly sweep re-reads the subscription — and
 * between Shopify renewing it and the sweep's next run, a paying shop would read
 * as free. Two days covers that and a store whose charge Shopify retries. A
 * subscription set to cancel gets no margin: it ends when Shopify says.
 */
export const RENEWAL_MARGIN_MS = 2 * 24 * 60 * 60_000;

/**
 * Our plan for one of Shopify's plan handles, or null for `free` and anything
 * unknown. A suffix after a hyphen or underscore is allowed (`pro-annual`), so
 * a plan re-created with a new handle in the Partner Dashboard still maps.
 */
export function planForHandle(handle: string): PaidPlanId | null {
  const base = handle.trim().toLowerCase().split(/[-_]/)[0];

  return base === "starter" || base === "pro" ? base : null;
}

export function cadenceForPeriod(period: string): BillingCadence | null {
  if (period === "ANNUAL") return "yearly";
  if (period === "EVERY_30_DAYS") return "monthly";
  return null;
}

export function toShopifyState(input: {
  workspaceId: string;
  shop: string;
  subscription: ShopifyActiveSubscription | null;
  /** Shopify froze the subscription over a store billing problem. */
  frozen: boolean;
  now?: Date;
}): SubscriptionState {
  const { subscription } = input;
  const base = {
    userId: input.workspaceId,
    billingCustomerId: input.shop,
    provider: "shopify" as const,
  };

  const plan = subscription
    ? (subscription.items.map((item) => planForHandle(item.handle)).find(Boolean) ?? null)
    : null;

  // No subscription, or one to Shopify's free plan: the free plan, and nothing
  // left running that could grant more.
  if (!subscription || !plan) {
    return {
      ...base,
      plan: "free",
      status: "canceled",
      billingSubscriptionId: "",
      currentPeriodEnd: null,
      cadence: null,
    };
  }

  const end = subscription.currentBillingCycle?.endTime ?? subscription.trialEndsAt;
  const endMs = end ? Date.parse(end) : Number.NaN;

  return {
    ...base,
    plan,
    status: input.frozen ? "paused" : "active",
    // There is no subscription id we could act on — plan changes happen on
    // Shopify's own page — so the plan handle is kept, for support.
    billingSubscriptionId: subscription.items.map((item) => item.handle).join(","),
    currentPeriodEnd: Number.isFinite(endMs)
      ? new Date(subscription.cancelAtEndOfCycle ? endMs : endMs + RENEWAL_MARGIN_MS).toISOString()
      : null,
    cadence: cadenceForPeriod(subscription.billingPeriod),
  };
}
