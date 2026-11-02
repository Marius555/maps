import { fail } from "@/lib/api/responses";
import type { SubscriptionState } from "./types";

/**
 * Whether Shopify, not Lemon Squeezy, bills this subscription row
 * (docs/notes/shopify.md, "Billing").
 *
 * Every Lemon route that acts on the stored subscription — change plan,
 * cancel, resume, invoices, the cancel that starts an account deletion — asks
 * this first. A Shopify row's `billingSubscriptionId` is the plan handle
 * (`"starter"`), which Lemon would answer with a 404 at best. A plan Shopify
 * bills is changed and cancelled on Shopify's own plan page, never through our
 * checkout (App Store requirement 1.2.1).
 *
 * Absent `provider` is Lemon, which is every row written before Shopify.
 */
export function isShopifyBilled(
  subscription: Pick<SubscriptionState, "provider"> | null | undefined,
): boolean {
  return subscription?.provider === "shopify";
}

export const SHOPIFY_BILLED_MESSAGE =
  "Shopify bills this plan. Change or cancel it on Shopify's plan page: Settings → Billing → Change plan.";

/** A 409 for a Lemon billing route asked about a Shopify-billed row, or null to carry on. */
export function refuseShopifyBilled(
  subscription: Pick<SubscriptionState, "provider"> | null | undefined,
) {
  return isShopifyBilled(subscription) ? fail("conflict", SHOPIFY_BILLED_MESSAGE, 409) : null;
}
