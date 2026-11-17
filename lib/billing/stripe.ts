import "server-only";

import { env } from "@/lib/env";
import {
  assertStripeId,
  BillingError,
  call,
  isoFromUnix,
  stripe,
  type Stripe,
} from "./stripe-client";
import {
  activePromotionCodeId,
  createDiscount,
  deleteDiscount,
  listDiscountRedemptions,
  listDiscounts,
} from "./stripe-discounts";
import { offerForPrice, priceIdFor } from "./stripe-prices";
import type {
  BillingProvider,
  Checkout,
  CheckoutRequest,
  Invoice,
  InvoicePage,
  InvoiceStatus,
  PaymentMethod,
  PlanChangeRequest,
  ScheduledChange,
  SubscriptionDetails,
  SubscriptionState,
  SubscriptionStatus,
} from "./types";

/**
 * Stripe, through **Managed Payments** — Stripe (selling as Link) is the
 * merchant of record, so tax, invoices and refunds stay the provider's, exactly
 * as they were with Lemon Squeezy.
 *
 * **Everything provider-specific stops here** and in its two siblings
 * (`stripe-client.ts`, the plumbing; `stripe-discounts.ts`, the codes). Lookup
 * keys, `incomplete_expired`, subscription schedules — none of it is seen
 * outside `lib/billing/`, which is what lets §6's provider-neutral column names
 * stay honest.
 *
 * Test mode is decided by the **key** (`sk_test_…` or `sk_live_…`), not by a
 * flag we send, so there is nothing in this file that could be left switched
 * the wrong way on the day real money starts arriving.
 */

export { BillingError };

export function createStripeProvider(): BillingProvider {
  return {
    name: "stripe",
    createCheckout,
    subscriptionDetails,
    listInvoices,
    cancelSubscription,
    resumeSubscription,
    changePlan,
    keepPlan,
    portalSession,
    createDiscount,
    listDiscounts,
    listDiscountRedemptions,
    deleteDiscount,
  };
}

export function assertSubscriptionId(id: string): string {
  return assertStripeId(id, "sub", "subscription id");
}

/* ------------------------------------------------------------------ *
 * Checkout
 * ------------------------------------------------------------------ */

/**
 * The Checkout Session a plan is bought through. Pure and exported for the
 * tests, because the two things that matter most here are invisible from
 * anywhere else: where the buyer is returned to, and which account the
 * subscription will be attached to.
 */
export function checkoutParams(
  request: CheckoutRequest,
  ids: { priceId: string; promotionCodeId: string | null; customerId: string | null },
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    /*
     * Stripe as merchant of record. Without it the checkout would sell as us,
     * with no VAT handled — the whole reason a merchant of record was chosen.
     */
    managed_payments: { enabled: true },
    line_items: [{ price: ids.priceId, quantity: 1 }],
    /*
     * A former subscriber reuses their customer, so their invoices stay in one
     * place and the webhook's customer fallback keeps working. Everybody else is
     * pre-filled by email; Stripe then makes the customer.
     */
    ...(ids.customerId ? { customer: ids.customerId } : { customer_email: request.email }),
    client_reference_id: request.userId,
    /*
     * Our own user id, on the **subscription**. This is the entire link between
     * a payment and an account: every subscription event carries it, and the
     * alternative — matching on the email — would be unsound, because the buyer
     * can change that address at the checkout and would then be granted
     * somebody else's plan.
     *
     * Only the subscription's metadata is trusted, never `client_reference_id`:
     * a Payment Link accepts that one from its URL, so anybody could type a
     * user id into it. Metadata can only be set by a key — by this function.
     */
    subscription_data: { metadata: { user_id: request.userId } },
    metadata: { user_id: request.userId },
    /*
     * **Not the Billing page, and that is a cookie decision rather than a
     * cosmetic one.** This navigation arrives from Stripe's domain, the session
     * cookie is `sameSite: "strict"`, and browsers withhold a Strict cookie on a
     * cross-site top-level navigation — so a return straight to the dashboard
     * reaches `proxy.ts` with no cookie visible and bounces somebody who has just
     * paid onto the login page. `/checkout/done` is outside the proxy's matcher
     * and hops on from the client. docs/notes/auth.md, the SameSite section.
     */
    success_url: `${env.appUrl}/checkout/done`,
    cancel_url: `${env.appUrl}/pricing`,
    /*
     * A code from a share link is applied up front; otherwise the checkout
     * offers its own code box. Stripe refuses both at once. Only a code ever
     * crosses here, never an amount: the provider decides what it is worth.
     */
    ...(ids.promotionCodeId
      ? { discounts: [{ promotion_code: ids.promotionCodeId }] }
      : { allow_promotion_codes: true }),
  };
}

async function createCheckout(request: CheckoutRequest): Promise<Checkout> {
  const priceId = await priceIdFor(request.plan, request.cadence);
  const promotionCodeId = request.discountCode
    ? await activePromotionCodeId(request.discountCode).catch(() => null)
    : null;
  const customerId =
    request.billingCustomerId && /^cus_[A-Za-z0-9]+$/.test(request.billingCustomerId)
      ? request.billingCustomerId
      : null;

  const create = (customer: string | null) =>
    call("create checkout", (client) =>
      client.checkout.sessions.create(
        checkoutParams(request, { priceId, promotionCodeId, customerId: customer }),
      ),
    );

  let session: Stripe.Checkout.Session;

  try {
    session = await create(customerId);
  } catch (error) {
    /*
     * A stored customer the key cannot see — one made in test mode, read with a
     * live key — would otherwise make the account unable to buy anything.
     * Retried once with the email instead.
     */
    if (
      customerId &&
      error instanceof BillingError &&
      error.fields.some((field) => field.attribute === "customer")
    ) {
      session = await create(null);
    } else {
      throw error;
    }
  }

  if (!session.url) {
    throw new BillingError("The payment provider returned no checkout link.");
  }

  return { url: session.url };
}

/* ------------------------------------------------------------------ *
 * Reading a subscription
 * ------------------------------------------------------------------ */

/**
 * The provider's status, as one of ours.
 *
 * **A cancellation is not here at all.** Stripe keeps a subscription set to
 * cancel at the end of its period `active` until that end, so `active` it stays
 * — and `currentPeriodEnd` (from `cancel_at`) is what closes it, either when
 * `customer.subscription.deleted` arrives or, if that event is ever missed, when
 * `getUserPlan` reads the date. Mapping "set to cancel" to `canceled` would take
 * a customer's paid plan away the moment they clicked cancel.
 *
 * `unpaid` is the end of Stripe's retries, not the start of them, so it is
 * `canceled` rather than `past_due`. `incomplete` has never been paid at all and
 * grants nothing.
 *
 * An unrecognised status is `canceled`, which is the safe direction here.
 * Guessing `active` for a word we do not know would be giving the product away
 * on the strength of a typo.
 */
export function toStatus(status: string): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    paused: "paused",
    unpaid: "canceled",
    canceled: "canceled",
    incomplete: "canceled",
    incomplete_expired: "canceled",
  };

  return map[status] ?? "canceled";
}

function idOf(value: string | { id: string } | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

/**
 * A subscription object as our own state. Null when its price is none of our
 * four lookup keys — another product in the same account, or a price replaced
 * without `setup:stripe` moving the key.
 *
 * Shared by the webhook and by every read, so a subscription read from an event
 * and the same subscription fetched from the API can never be interpreted two
 * different ways.
 */
export function toState(subscription: Stripe.Subscription): Omit<SubscriptionState, "userId"> | null {
  const item = subscription.items.data[0];
  const offer = offerForPrice(item?.price);

  if (!item || !offer) return null;

  return {
    plan: offer.plan,
    cadence: offer.cadence,
    status: toStatus(subscription.status),
    billingCustomerId: idOf(subscription.customer),
    billingSubscriptionId: subscription.id,
    /*
     * The last day when it is winding down, the next renewal while it runs.
     * Preferring `cancel_at` is what makes "set to cancel stays active" safe —
     * the plan stays until exactly the day that was paid for. Since API version
     * 2025-03-31 the period lives on the item, not the subscription.
     */
    currentPeriodEnd: isoFromUnix(
      subscription.cancel_at ?? subscription.ended_at ?? item.current_period_end,
    ),
  };
}

/** Whose subscription this is, from the metadata the checkout wrote. */
export function userIdOf(subscription: Stripe.Subscription): string | null {
  const id = subscription.metadata?.user_id;
  return typeof id === "string" && id ? id : null;
}

/**
 * The downgrade a schedule has booked, or null.
 *
 * The next phase that starts after now, when its price is one of ours and is
 * not what is already billed. Needs `schedule.phases.items.price` expanded; a
 * bare schedule id reads as nothing booked.
 */
export function scheduledOf(
  subscription: Stripe.Subscription,
  now: number = Date.now(),
): ScheduledChange | null {
  const schedule = subscription.schedule;
  if (!schedule || typeof schedule === "string") return null;
  if (schedule.status !== "active" && schedule.status !== "not_started") return null;

  const nowSeconds = Math.floor(now / 1000);
  const next = schedule.phases.find((phase) => phase.start_date > nowSeconds);
  const price = next?.items[0]?.price;
  const offer = price && typeof price === "object" && !("deleted" in price && price.deleted)
    ? offerForPrice(price as Stripe.Price)
    : null;
  const current = offerForPrice(subscription.items.data[0]?.price);

  if (!next || !offer) return null;
  if (current && current.plan === offer.plan && current.cadence === offer.cadence) return null;

  return { ...offer, at: isoFromUnix(next.start_date) ?? "" };
}

function toPayment(method: string | Stripe.PaymentMethod | null | undefined): PaymentMethod {
  if (!method || typeof method === "string") return { method: null, brand: null, lastFour: null };

  if (method.type === "paypal") return { method: "paypal", brand: null, lastFour: null };

  if (method.type === "card" && method.card) {
    return {
      method: "card",
      brand: method.card.brand?.trim().toLowerCase() || null,
      lastFour: method.card.last4?.trim() || null,
    };
  }

  return { method: null, brand: null, lastFour: null };
}

/** The customer's default card, when the subscription carries none of its own. */
function customerPayment(subscription: Stripe.Subscription) {
  const customer = subscription.customer;
  if (!customer || typeof customer === "string" || ("deleted" in customer && customer.deleted)) {
    return null;
  }

  return (customer as Stripe.Customer).invoice_settings?.default_payment_method ?? null;
}

/** Our own route; it opens a fresh portal session per press — see `SubscriptionDetails`. */
const PORTAL_ROUTE = "/api/account/billing-portal";

/** A subscription as the Billing page's facts. Exported for the tests. */
export function toDetails(
  subscription: Stripe.Subscription,
  now: number = Date.now(),
): SubscriptionDetails {
  const item = subscription.items.data[0];
  const cancelled =
    subscription.status === "canceled" ||
    subscription.cancel_at_period_end ||
    subscription.cancel_at !== null;

  return {
    state: toState(subscription),
    cancelled,
    renewsAt: cancelled ? null : isoFromUnix(item?.current_period_end),
    endsAt: cancelled
      ? isoFromUnix(subscription.cancel_at ?? subscription.ended_at ?? item?.current_period_end)
      : null,
    payment: toPayment(subscription.default_payment_method ?? customerPayment(subscription)),
    scheduled: cancelled ? null : scheduledOf(subscription, now),
    portalUrl: PORTAL_ROUTE,
    updatePaymentUrl: `${PORTAL_ROUTE}?flow=payment`,
  };
}

const EXPAND = [
  "default_payment_method",
  "customer.invoice_settings.default_payment_method",
  "schedule.phases.items.price",
];

/** The subscription with everything the Billing page reads. Null on a 404. */
async function retrieve(billingSubscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await call("read subscription", (client) =>
      client.subscriptions.retrieve(assertSubscriptionId(billingSubscriptionId), {
        expand: EXPAND,
      }),
    );
  } catch (error) {
    if (error instanceof BillingError && error.status === 404) return null;

    throw error;
  }
}

/**
 * One subscription, read whole. Null on a 404 (or an id that is not a Stripe
 * one — a row left over from another provider), thrown on anything else, for
 * the reason `fetchSubscription` gives.
 */
async function subscriptionDetails(
  billingSubscriptionId: string,
): Promise<SubscriptionDetails | null> {
  if (!billingSubscriptionId) return null;

  const subscription = await retrieve(billingSubscriptionId);

  return subscription ? toDetails(subscription) : null;
}

/**
 * What the API says about a subscription right now, and whose it is. Null if
 * the provider has no such subscription.
 *
 * **A 404 is null, and every other failure still throws.** That split is the
 * difference between an event worth retrying and one that will produce the same
 * nothing tomorrow, and the webhook turns it into a 200 or a 500 accordingly.
 */
export async function fetchSubscription(
  billingSubscriptionId: string,
): Promise<{ state: Omit<SubscriptionState, "userId"> | null; userId: string | null } | null> {
  if (!billingSubscriptionId) return null;

  let subscription: Stripe.Subscription | null;

  try {
    subscription = await retrieve(billingSubscriptionId);
  } catch (error) {
    if (error instanceof BillingError && error.status === 404) return null;
    throw error;
  }

  return subscription ? { state: toState(subscription), userId: userIdOf(subscription) } : null;
}

/* ------------------------------------------------------------------ *
 * Changing a subscription
 * ------------------------------------------------------------------ */

/** Let go of a booked change, so the subscription simply renews as it is. */
async function releaseSchedule(subscription: Stripe.Subscription): Promise<void> {
  const schedule = subscription.schedule;
  if (!schedule) return;

  const id = idOf(schedule);
  const status = typeof schedule === "string" ? null : schedule.status;
  if (status && status !== "active" && status !== "not_started") return;

  await call("release schedule", (client) => client.subscriptionSchedules.release(id));
}

async function mustRetrieve(billingSubscriptionId: string): Promise<Stripe.Subscription> {
  const subscription = await retrieve(billingSubscriptionId);

  if (!subscription) {
    throw new BillingError("The payment provider has no record of that subscription.", 404);
  }

  return subscription;
}

/**
 * Stop the renewal. The subscription keeps running to the end of what was paid
 * for, still `active`, with `cancel_at` set — which `toState` reads as the last
 * day, exactly as the webhook's `customer.subscription.updated` will a moment
 * later. A booked downgrade is let go first: it would otherwise start a new
 * period on the cheaper plan instead of ending.
 */
async function cancelSubscription(
  billingSubscriptionId: string,
): Promise<SubscriptionDetails | null> {
  await releaseSchedule(await mustRetrieve(billingSubscriptionId));

  const subscription = await call("cancel subscription", (client) =>
    client.subscriptions.update(assertSubscriptionId(billingSubscriptionId), {
      cancel_at_period_end: true,
      expand: EXPAND,
    }),
  );

  return toDetails(subscription);
}

/** Undo a cancellation, while the period it ends at has not arrived yet. */
async function resumeSubscription(
  billingSubscriptionId: string,
): Promise<SubscriptionDetails | null> {
  const subscription = await call("resume subscription", (client) =>
    client.subscriptions.update(assertSubscriptionId(billingSubscriptionId), {
      cancel_at_period_end: false,
      expand: EXPAND,
    }),
  );

  return toDetails(subscription);
}

/**
 * A new plan on the subscription the customer already has.
 *
 * **`now` (an upgrade)**: the item's price is swapped with
 * `create_prorations`, so the difference lands on the next bill. When the
 * interval changes too (monthly → yearly) Stripe restarts the billing period and
 * invoices at once, less what was left of the old one; the plan's note says so
 * before the press.
 *
 * **`renewal` (a downgrade)**: a subscription schedule keeps the current price
 * until the period paid for ends and moves to the new one then, with nothing
 * prorated. This is what Lemon Squeezy could not do and the reason the `kept*`
 * columns existed: the provider now keeps billing what was paid for, so
 * `getUserPlan` is right without any help from us.
 *
 * Either way a downgrade already booked is let go first, so there is only ever
 * one booked change.
 */
async function changePlan(request: PlanChangeRequest): Promise<SubscriptionDetails | null> {
  const subscription = await mustRetrieve(request.billingSubscriptionId);
  const item = subscription.items.data[0];

  if (!item) throw new BillingError("That subscription has nothing on it to change.");

  const priceId = await priceIdFor(request.plan, request.cadence);

  await releaseSchedule(subscription);

  if (request.when === "now") {
    const updated = await call("change plan", (client) =>
      client.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: upgradeProration(item.price, request.cadence),
        expand: EXPAND,
      }),
    );

    return toDetails(updated);
  }

  const schedule = await call("book downgrade", (client) =>
    client.subscriptionSchedules.create({ from_subscription: subscription.id }),
  );
  const current = schedule.phases[0];

  await call("book downgrade", (client) =>
    client.subscriptionSchedules.update(schedule.id, bookedPhases(request, {
      startDate: current?.start_date ?? item.current_period_start,
      endDate: item.current_period_end,
      currentPriceId: item.price.id,
      quantity: item.quantity ?? 1,
      newPriceId: priceId,
    })),
  );

  return subscriptionDetails(subscription.id);
}

/**
 * How an upgrade is prorated. On the same interval the difference goes on the
 * next bill (`create_prorations`). Across intervals it is invoiced **now**
 * (`always_invoice`), because `create_prorations` there was measured
 * (2026-11-17, test mode) to stretch the period to a year and leave the whole
 * proration pending until then — a year of the dearer plan on credit, and €741
 * in one charge a year later. `upgradeNote` tells the buyer which. Exported for
 * the tests.
 */
export function upgradeProration(
  current: Pick<Stripe.Price, "recurring">,
  cadence: PlanChangeRequest["cadence"],
): "create_prorations" | "always_invoice" {
  const target = cadence === "yearly" ? "year" : "month";

  return current.recurring?.interval === target ? "create_prorations" : "always_invoice";
}

/**
 * The two phases of a booked downgrade: what is paid for, to its end; then the
 * new plan, released back to an ordinary subscription after one period. Pure
 * and exported for the tests.
 */
export function bookedPhases(
  request: Pick<PlanChangeRequest, "cadence">,
  ids: {
    startDate: number;
    endDate: number;
    currentPriceId: string;
    quantity: number;
    newPriceId: string;
  },
): Stripe.SubscriptionScheduleUpdateParams {
  return {
    end_behavior: "release",
    proration_behavior: "none",
    phases: [
      {
        items: [{ price: ids.currentPriceId, quantity: ids.quantity }],
        start_date: ids.startDate,
        end_date: ids.endDate,
      },
      {
        items: [{ price: ids.newPriceId, quantity: 1 }],
        proration_behavior: "none",
        duration: { interval: request.cadence === "yearly" ? "year" : "month", interval_count: 1 },
      },
    ],
  };
}

/** "Keep …": drop the booked downgrade. Nothing is charged; the paid plan renews. */
async function keepPlan(billingSubscriptionId: string): Promise<SubscriptionDetails | null> {
  await releaseSchedule(await mustRetrieve(billingSubscriptionId));

  return subscriptionDetails(billingSubscriptionId);
}

/**
 * A billing-portal session: the provider's own pages for the card, the billing
 * address and every past invoice. Made per press by our route rather than per
 * page render, because a portal link is short-lived.
 *
 * Managed Payments does not let the API set a subscription's payment method, so
 * the portal is the only way a card is changed — which is why "Update" opens it
 * straight on the card form.
 */
async function portalSession(
  billingCustomerId: string,
  options: { flow: "payment" | null; returnUrl: string },
): Promise<string> {
  const session = await call("open billing portal", (client) =>
    client.billingPortal.sessions.create({
      customer: assertStripeId(billingCustomerId, "cus", "customer id"),
      return_url: options.returnUrl,
      ...(options.flow === "payment" ? { flow_data: { type: "payment_method_update" as const } } : {}),
    }),
  );

  return session.url;
}

/* ------------------------------------------------------------------ *
 * Invoices
 * ------------------------------------------------------------------ */

/**
 * The page size. Ten is a year of a monthly plan; the table keeps a ten-row
 * height across pages so paging never moves what is under it.
 */
export const INVOICE_PAGE_SIZE = 10;

/**
 * How many are read. Stripe pages by cursor and gives no total, and the table
 * pages by number, so one request of this many is split into pages here — eight
 * years of a monthly plan, which no subscription of ours has yet.
 */
const INVOICE_READ_LIMIT = 100;

function formatMoney(minor: number, currency: string): string {
  try {
    const format = new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;

    return format.format(minor / 10 ** digits);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function invoiceStatus(invoice: Stripe.Invoice): InvoiceStatus | null {
  switch (invoice.status) {
    case "open":
      return "pending";
    case "void":
    case "uncollectible":
      return "void";
    case "paid": {
      const refunded = invoice.post_payment_credit_notes_amount ?? 0;
      if (refunded <= 0) return "paid";
      return refunded >= invoice.total ? "refunded" : "partial_refund";
    }
    default:
      // A draft is not an invoice anybody has been sent yet.
      return null;
  }
}

function invoiceReason(reason: string | null): Invoice["reason"] {
  switch (reason) {
    case "subscription_create":
      return "initial";
    case "subscription_cycle":
      return "renewal";
    case "subscription_update":
      return "updated";
    default:
      return "other";
  }
}

/** One invoice as ours, or null for one not to show. Exported for the tests. */
export function toInvoice(invoice: Stripe.Invoice): Invoice | null {
  const status = invoiceStatus(invoice);
  if (!status || !invoice.id) return null;

  return {
    id: invoice.id,
    createdAt: isoFromUnix(invoice.created) ?? "",
    reason: invoiceReason(invoice.billing_reason),
    total: formatMoney(invoice.total, invoice.currency),
    status,
    url: status === "pending" ? null : (invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null),
  };
}

/** A list of invoices as one numbered page of ours. Exported for the tests. */
export function toInvoicePage(invoices: readonly Stripe.Invoice[], page: number): InvoicePage {
  const all = invoices
    .map(toInvoice)
    .filter((invoice): invoice is Invoice => invoice !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lastPage = Math.max(1, Math.ceil(all.length / INVOICE_PAGE_SIZE));
  const current = Math.min(lastPage, Math.max(1, Math.floor(page)));

  return {
    invoices: all.slice((current - 1) * INVOICE_PAGE_SIZE, current * INVOICE_PAGE_SIZE),
    page: current,
    lastPage,
  };
}

async function listInvoices(billingSubscriptionId: string, page: number): Promise<InvoicePage> {
  if (!billingSubscriptionId) return { invoices: [], page: 1, lastPage: 1 };

  const list = await call("list invoices", (client) =>
    client.invoices.list({
      subscription: assertSubscriptionId(billingSubscriptionId),
      limit: INVOICE_READ_LIMIT,
    }),
  );

  return toInvoicePage(list.data, page);
}

/* ------------------------------------------------------------------ *
 * Webhooks
 * ------------------------------------------------------------------ */

/**
 * The event, if this body really came from Stripe; null otherwise.
 *
 * The signature is over the **raw bytes**, which is why the route reads
 * `request.text()` and never re-serialises. **An unset secret refuses
 * everybody** — not "skips verification": an open endpoint that writes
 * subscription rows is a free Pro plan for anyone who can POST.
 */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  if (!env.stripeWebhookSecret || !signature) return null;

  try {
    return stripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch {
    return null;
  }
}

/**
 * The subscription an event is about, or null for one that is about none.
 *
 * Subscription events carry it as their object; invoice events name it under
 * `parent.subscription_details` (API version 2025-03-31 onwards). The route
 * then reads the subscription fresh rather than trusting the event's snapshot:
 * Stripe does not promise delivery order, and an older `updated` landing after
 * a newer one would otherwise write yesterday's plan over today's.
 */
export function subscriptionIdOfEvent(event: Stripe.Event): string | null {
  const object = event.data.object as { object?: string; id?: string };

  if (object.object === "subscription") return object.id ?? null;

  if (object.object === "invoice") {
    const parent = (object as Stripe.Invoice).parent;
    const subscription = parent?.subscription_details?.subscription;

    return subscription ? idOf(subscription) : null;
  }

  return null;
}

/**
 * The events the webhook acts on. Listed rather than matched by prefix, because
 * a provider adding a new event should be a deliberate decision rather than
 * something that silently starts rewriting rows. Hand-kept in step with
 * `WEBHOOK_EVENTS` in `scripts/setup-stripe.mjs`, which subscribes the endpoint
 * to exactly these.
 */
export const BILLING_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
] as const;
