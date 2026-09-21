import type { PlanId } from "@/lib/repositories/plan-limits";

/**
 * What the app asks of a merchant of record, and nothing about which one.
 *
 * The same shape `lib/geocoding/types.ts` and `lib/routing/types.ts` take, for
 * the same reason and one extra. The shared reason is CLAUDE.md §7: a provider's
 * vocabulary stops at its own folder, so nothing outside `lib/billing/` knows
 * what a "variant" is or that statuses arrive spelled `on_trial`. The extra one
 * is §3, which names the choice as "Paddle **or** Lemon Squeezy" — a decision
 * taken once, on tax handling, with no claim that it is permanent — and §6, which
 * says the stored columns must not be named after whoever won.
 *
 * Three things are deliberately *not* in here:
 *
 * - **Prices.** They live in `lib/marketing/plans.ts`, are printed on the page,
 *   and are set in the provider's own dashboard. A third copy behind an interface
 *   would be a number that could disagree with both.
 * - **Refunds, invoices, tax.** That is the whole point of paying a merchant of
 *   record; re-implementing any of it here would be buying the service twice.
 * - **Anything that reads a subscription by user.** That is the repository's job,
 *   from our own table. Asking the provider would put a third-party HTTP call in
 *   the path of every page that checks a plan.
 */

/** Monthly or yearly. The two shapes a plan is sold in. */
export type BillingCadence = "monthly" | "yearly";

/** A plan somebody can actually buy. `free` is not one of them. */
export type PaidPlanId = Exclude<PlanId, "free">;

export type CheckoutRequest = {
  plan: PaidPlanId;
  cadence: BillingCadence;
  /** Prefilled at the checkout, so nobody retypes what we already know. */
  email: string;
  /**
   * Ours, not the provider's.
   *
   * It is round-tripped through the checkout and comes back on the webhook, which
   * is how a payment finds the account that made it. Without it the only link
   * between the two is an email address the buyer is free to change at the
   * checkout — and matching on that would hand somebody else's subscription to
   * whoever typed their address.
   */
  userId: string;
};

/** Where to send the buyer. Nothing else about the checkout crosses out. */
export type Checkout = { url: string };

/**
 * A subscription as this app understands it.
 *
 * `status` is already one of ours — the provider's vocabulary is mapped inside
 * its own adapter, because that mapping is a judgement (a cancelled subscription
 * is still active until it ends) and judgements belong where they can be tested,
 * not spread across the callers.
 */
export type SubscriptionState = {
  userId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  billingCustomerId: string;
  billingSubscriptionId: string;
  /** ISO, or null when no end is known. Absent must keep meaning "no expiry". */
  currentPeriodEnd: string | null;
};

/**
 * The five states the `subscriptions` table's enum allows.
 *
 * Hand-kept in step with `SUBSCRIPTION_STATUSES` in `scripts/appwrite-schema.mjs`,
 * the way `SHAPE_KINDS` is — the schema file is plain `.mjs` and cannot import a
 * type. `subscriptions.repository.test.ts` asserts the two agree.
 */
export const SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "canceled",
  "paused",
  "trialing",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type BillingProvider = {
  /** For error messages and logs. Never rendered to a customer. */
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<Checkout>;
  /**
   * Where this customer manages their own card, cancellation and invoices.
   *
   * Fetched when asked rather than stored, because these URLs are signed and
   * expire — a column holding one would be a "Manage subscription" button that
   * works for a week and then quietly does not.
   */
  portalUrl(billingSubscriptionId: string): Promise<string | null>;
};
