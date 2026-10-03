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
 * - **Refunds and tax.** That is the whole point of paying a merchant of record;
 *   re-implementing any of it here would be buying the service twice. Invoices
 *   are *listed* here now (`listInvoices`) so the Billing page can show them,
 *   but the provider still issues, numbers, taxes and stores every one — each
 *   row links to the provider's own PDF, and nothing about an invoice is kept
 *   in our database.
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
  /**
   * A discount code to pre-fill, from a share link. Upper-case letters and
   * digits only, checked by `checkoutSchema`; the provider decides whether it is
   * valid and what it is worth.
   */
  discountCode?: string;
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
  /**
   * Monthly or yearly, or null when it is not known.
   *
   * Null is not "monthly". Every subscription recorded before this field existed
   * has none, and printing a monthly price for one would be telling a yearly
   * customer they pay something they do not. It only ever decides what the
   * account page shows and what a plan switch asks for — never what a plan
   * grants, which is `plan` alone.
   */
  cadence: BillingCadence | null;
};

/** What a plan switch asks the provider for. */
export type PlanChangeRequest = {
  billingSubscriptionId: string;
  plan: PaidPlanId;
  cadence: BillingCadence;
  /**
   * Whether the difference is settled against the period already paid for.
   *
   * True for an upgrade: the new plan starts now and the difference is added to
   * the next bill. False for a downgrade, and for undoing one: the next bill is
   * simply the new price and no money moves today, because the period already
   * paid for is kept rather than credited back — see `planChange`.
   */
  prorate: boolean;
};

/**
 * A plan already paid for, kept until the renewal after a downgrade.
 *
 * The provider moves a subscription the moment it is asked and has no way to
 * book a change for the end of the period — so a downgrade is sent at once,
 * without proration, and this is what keeps the customer on what they paid for
 * in the meantime. `getUserPlan` grants it until `until`, and the account page
 * says so.
 */
export type KeptPlan = {
  plan: PaidPlanId;
  /** Null only for a subscription whose cadence was never known. */
  cadence: BillingCadence | null;
  /** ISO. The renewal the downgrade takes effect at. */
  until: string;
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

/**
 * How a subscription is paid. `brand` and `lastFour` are a card's; PayPal has
 * neither, and says so with `method`.
 */
export type PaymentMethod = {
  method: "card" | "paypal" | null;
  /** Lowercase, as networks spell themselves: "visa", "mastercard", "amex"… */
  brand: string | null;
  lastFour: string | null;
};

/**
 * Everything the Billing page shows about one subscription, from one request.
 *
 * `cancelled` is the fact our own row cannot hold. The provider keeps a
 * cancelled subscription running to the end of the period, so `toStatus` maps it
 * to `active` — correctly, for deciding what a plan grants — and the row then
 * cannot tell "renews on" from "ends on". This can, because it is asked live.
 */
export type SubscriptionDetails = {
  /** Null when the variant is none of ours. */
  state: Omit<SubscriptionState, "userId"> | null;
  cancelled: boolean;
  /** The next charge, while it is running. */
  renewsAt: string | null;
  /** The last day, once it is cancelled or has expired. */
  endsAt: string | null;
  payment: PaymentMethod;
  /**
   * Signed, and good for 24 hours from this request. Fetched per visit and
   * never stored, so a stored one cannot become a button that quietly fails.
   */
  portalUrl: string | null;
  updatePaymentUrl: string | null;
};

/** The provider's invoice statuses, which are also ours: they need no judgement. */
export type InvoiceStatus = "pending" | "paid" | "void" | "refunded" | "partial_refund";

export type Invoice = {
  id: string;
  createdAt: string;
  /** Why it was raised: the first payment, a renewal, or a plan change. */
  reason: "initial" | "renewal" | "updated" | "other";
  /** Already formatted in the invoice's own currency: "€19.00". */
  total: string;
  status: InvoiceStatus;
  /**
   * The provider's PDF. Signed but not expiring, so it can be rendered into a
   * page. Null while the invoice is still pending, when there is no PDF yet.
   */
  url: string | null;
};

export type InvoicePage = {
  invoices: Invoice[];
  page: number;
  lastPage: number;
};

/* ------------------------------------------------------------------ *
 * Discounts
 *
 * The provider is the only record of these (docs/notes/billing.md,
 * "Discounts"): created and deleted from the operator console, read live,
 * never mirrored into Appwrite. Plans are named as ours — a plan and a
 * cadence — never as the provider's variant ids.
 * ------------------------------------------------------------------ */

/** One thing that can be bought: a paid plan at one cadence. */
export type PlanOffer = { plan: PaidPlanId; cadence: BillingCadence };

/** A percentage off, or a fixed amount off in the store's currency. */
export type DiscountAmountType = "percent" | "fixed";

/**
 * How many charges of a subscription it applies to: the first only, the first
 * N months', or every one.
 */
export type DiscountDuration = "once" | "repeating" | "forever";

export type DiscountInput = {
  name: string;
  /** Upper-case letters and digits. What a customer types at the checkout. */
  code: string;
  amountType: DiscountAmountType;
  /** A whole percentage (1–100), or cents when `amountType` is `fixed`. */
  amount: number;
  duration: DiscountDuration;
  /** Months, when `duration` is `repeating`; null otherwise. */
  months: number | null;
  /** How many times it may be redeemed in total, by anybody. Null is unlimited. */
  maxUses: number | null;
  /** ISO. Null starts it at once. */
  startsAt: string | null;
  /** ISO. Null never expires. */
  expiresAt: string | null;
  /** Which plans it applies to. Empty is every plan. */
  plans: PlanOffer[];
};

export type Discount = DiscountInput & {
  id: string;
  createdAt: string;
  /** Redemptions so far, or null when they could not be counted. */
  uses: number | null;
  /**
   * Limited to at least one product that is none of our four plans — made in
   * the provider's own dashboard, say. Shown so a list of plans that looks
   * shorter than the truth says so.
   */
  otherProducts: boolean;
  /** Only test-mode checkouts accept it. */
  testMode: boolean;
};

/**
 * A discount as a pricing-page visitor may see it: what it takes off and from
 * what, and when it ends. Never its name, its cap or how often it has been
 * used — those are the operator's business.
 */
export type PublicDiscount = Pick<
  Discount,
  "code" | "amountType" | "amount" | "duration" | "months" | "plans" | "expiresAt"
>;

/** What `/api/pricing/offer` answers. */
export type PricingOffer = {
  /** The promo the operator chose to show everybody, if it is live. */
  featured: PublicDiscount | null;
  /** The code that was asked about, if it is live. */
  code: PublicDiscount | null;
  /** Why the code that was asked about is not applied. Null when none was asked about, or it is. */
  codeError: string | null;
  /**
   * True when the code could not be checked at all (the provider did not
   * answer) — neither valid nor refused. The page then keeps what it last knew
   * rather than forgetting a code it has no news about.
   */
  codeUnchecked?: boolean;
};

/** Where a discount stands right now. Decided by `discountStatus`. */
export type DiscountStatus = "scheduled" | "active" | "expired" | "used_up";

export type DiscountRedemption = {
  id: string;
  createdAt: string;
  /** The buyer's address, from the order. Null when the order could not be read. */
  email: string | null;
  /** What it took off the order, in cents of `currency`. */
  saved: number;
  /** ISO 4217, from the order. Null when the order could not be read. */
  currency: string | null;
};

export type DiscountRedemptionPage = {
  redemptions: DiscountRedemption[];
  page: number;
  lastPage: number;
};

export type BillingProvider = {
  /** For error messages and logs. Never rendered to a customer. */
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<Checkout>;
  /**
   * The subscription as the provider sees it right now: plan, whether it is
   * cancelled, how it is paid, and the two signed links out.
   *
   * Null for a subscription the provider does not have. Throws when the provider
   * cannot be asked — the Billing page catches that and draws without it.
   */
  subscriptionDetails(billingSubscriptionId: string): Promise<SubscriptionDetails | null>;
  /**
   * One page of this subscription's invoices, newest first, ten at a time.
   *
   * By subscription id, never by customer or email: the id comes off the
   * caller's own `subscriptions` row, which is what stops this from being a way
   * to read somebody else's invoices.
   */
  listInvoices(billingSubscriptionId: string, page: number): Promise<InvoicePage>;
  /**
   * Stop the subscription renewing. It keeps running to the end of the period
   * already paid for, then expires. Resolves to the subscription afterwards.
   */
  cancelSubscription(billingSubscriptionId: string): Promise<SubscriptionDetails | null>;
  /** Undo a cancellation before the period ends. */
  resumeSubscription(billingSubscriptionId: string): Promise<SubscriptionDetails | null>;
  /**
   * Move a running subscription to another plan or cadence, in place.
   *
   * **Not a second checkout.** A checkout for somebody who already pays opens a
   * second subscription beside the first, and they are then charged twice for
   * one account. This changes the one they have, **immediately** — the provider
   * has no scheduled change — prorating the difference onto the next renewal
   * or, with `prorate: false`, simply billing the new price from then on.
   *
   * Resolves to the subscription as the provider now reports it, or null when
   * the answer names no plan of ours. Throws when the provider refuses: a change
   * that did not happen has to be said out loud.
   */
  changePlan(request: PlanChangeRequest): Promise<Omit<SubscriptionState, "userId"> | null>;
  /**
   * The discount codes, newest first, each with its redemption count. The
   * operator console's only reader; never in a customer's path.
   */
  listDiscounts(): Promise<Discount[]>;
  /**
   * Make a discount code at the provider. There is no edit: the provider can
   * create and delete a discount but not change one.
   */
  createDiscount(input: DiscountInput): Promise<Discount>;
  /** One page of who redeemed a discount, newest first. */
  listDiscountRedemptions(discountId: string, page: number): Promise<DiscountRedemptionPage>;
  /**
   * Stop a code working at the checkout. Subscriptions that already redeemed it
   * keep what they were given.
   */
  deleteDiscount(discountId: string): Promise<void>;
};
