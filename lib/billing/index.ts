import "server-only";

import { createLemonProvider } from "./lemon";
import type { BillingProvider } from "./types";

/**
 * The merchant of record, memoised per process.
 *
 * The same shape as `lib/geocoding/index.ts` and `lib/routing/index.ts`: one
 * getter, one instance, and a provider named in exactly one place. There is no
 * environment switch here yet because there is one provider — when there is a
 * second, this is the line that changes and nothing else does, which is the whole
 * reason the interface exists (CLAUDE.md §3 records the choice as "Paddle **or**
 * Lemon Squeezy", not as settled forever).
 */
let provider: BillingProvider | null = null;

export function getBilling(): BillingProvider {
  provider ??= createLemonProvider();

  return provider;
}

export { BillingError } from "./lemon";
export type {
  BillingCadence,
  BillingProvider,
  Checkout,
  CheckoutRequest,
  KeptPlan,
  PaidPlanId,
  PlanChangeRequest,
  SubscriptionState,
  SubscriptionStatus,
} from "./types";
