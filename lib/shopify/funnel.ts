import type { SubscriptionState } from "@/lib/billing/types";

/**
 * The product funnel (signup → first location → publish → paid, CLAUDE.md §3)
 * for a Shopify shop, whose first and last steps happen where no page of ours
 * is drawn: the install, and the return from Shopify's plan page, are both the
 * App Home's redirect. So those two are captured on the server
 * (`lib/posthog/server.ts`), under the same names the web sends, and split by
 * `method` / `provider` and the person's `platform`.
 *
 * Pure, so what counts as a purchase is tested without Shopify.
 */

/** `user_signed_up` for a shop that just installed the app — once, at creation. */
export const SHOPIFY_SIGNUP = { method: "shopify", $set: { platform: "shopify" } } as const;

type PlanReading = Pick<SubscriptionState, "plan" | "cadence" | "status"> | null;

/**
 * `checkout_completed`'s properties when the merchant just started a paid plan
 * or moved to a different one, else `null` — still free, a move down to free,
 * the same plan read again (a reload of the return page), or a frozen one.
 */
export function shopifyPlanPurchase(
  before: PlanReading,
  after: PlanReading,
): { provider: "shopify"; plan: SubscriptionState["plan"]; cadence: SubscriptionState["cadence"] } | null {
  if (!after || after.plan === "free" || after.status !== "active") return null;

  const unchanged =
    before?.status === "active" && before.plan === after.plan && before.cadence === after.cadence;
  if (unchanged) return null;

  return { provider: "shopify", plan: after.plan, cadence: after.cadence };
}
