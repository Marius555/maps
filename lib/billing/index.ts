import "server-only";

import { createStripeProvider } from "./stripe";
import type { BillingProvider } from "./types";

/**
 * The merchant of record, memoised per process.
 *
 * The same shape as `lib/geocoding/index.ts` and `lib/routing/index.ts`: one
 * getter, one instance, and a provider named in exactly one place. It has
 * changed once already — Lemon Squeezy to Stripe Managed Payments, November
 * 2026 — and this line plus the adapter files were all that had to.
 */
let provider: BillingProvider | null = null;

export function getBilling(): BillingProvider {
  provider ??= createStripeProvider();

  return provider;
}

export { BillingError } from "./stripe-client";
export type {
  BillingCadence,
  BillingProvider,
  Checkout,
  CheckoutRequest,
  Discount,
  DiscountAmountType,
  DiscountDuration,
  DiscountInput,
  DiscountRedemption,
  DiscountRedemptionPage,
  DiscountStatus,
  Invoice,
  InvoicePage,
  InvoiceStatus,
  KeptPlan,
  PaidPlanId,
  PaymentMethod,
  PlanChangeRequest,
  PlanOffer,
  ScheduledChange,
  SubscriptionDetails,
  SubscriptionState,
  SubscriptionStatus,
} from "./types";
