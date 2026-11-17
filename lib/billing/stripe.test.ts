import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pure decisions in the Stripe adapter, tested without a network, a
 * database or a server.
 *
 * They are worth testing and the HTTP plumbing around them is not, because these
 * are the parts that are *silently* wrong. A broken request fails loudly in
 * front of somebody holding a card; a status mapped the wrong way takes a paying
 * customer's plan away three weeks later, and nothing reports it. The checkout's
 * parameters are tested for the same reason: the URL a buyer is returned to and
 * the account a subscription is attached to are invisible from anywhere else.
 */

const SECRET = "whsec_test_secret";

vi.mock("@/lib/env", () => ({
  env: {
    appwriteApiKey: "test-key",
    databaseId: "test-db",
    storageId: "test-store",
    appUrl: "https://example.test",
    stripeSecretKey: "sk_test_123",
    stripeWebhookSecret: SECRET,
  },
}));

beforeEach(() => {
  vi.resetModules();
});

async function adapter() {
  return import("./stripe");
}

const NOW = Date.parse("2026-11-17T12:00:00.000Z");
const PERIOD_END = Math.floor(Date.parse("2026-12-17T12:00:00.000Z") / 1000);
const PERIOD_START = Math.floor(Date.parse("2026-11-17T12:00:00.000Z") / 1000);

function price(lookupKey: string | null, id = "price_1"): Stripe.Price {
  return { id, object: "price", lookup_key: lookupKey, product: "prod_1" } as unknown as Stripe.Price;
}

function subscription(overrides: Partial<Stripe.Subscription> = {}, key: string | null = "pinglide_pro_monthly"): Stripe.Subscription {
  return {
    id: "sub_123",
    object: "subscription",
    status: "active",
    customer: "cus_123",
    cancel_at: null,
    cancel_at_period_end: false,
    ended_at: null,
    metadata: { user_id: "user-1" },
    default_payment_method: null,
    schedule: null,
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          price: price(key),
          quantity: 1,
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("toStatus", () => {
  it("keeps the running states", async () => {
    const { toStatus } = await adapter();

    expect(toStatus("active")).toBe("active");
    expect(toStatus("trialing")).toBe("trialing");
    expect(toStatus("past_due")).toBe("past_due");
    expect(toStatus("paused")).toBe("paused");
  });

  it("grants nothing for a subscription that was never paid or has run out", async () => {
    const { toStatus } = await adapter();

    for (const status of ["incomplete", "incomplete_expired", "unpaid", "canceled"]) {
      expect(toStatus(status)).toBe("canceled");
    }
  });

  it("refuses a status it has never heard of", async () => {
    const { toStatus } = await adapter();

    expect(toStatus("on_vacation")).toBe("canceled");
  });
});

describe("toState", () => {
  it("reads the plan and cadence from the price's lookup key", async () => {
    const { toState } = await adapter();

    expect(toState(subscription({}, "pinglide_starter_yearly"))).toEqual({
      plan: "starter",
      cadence: "yearly",
      status: "active",
      billingCustomerId: "cus_123",
      billingSubscriptionId: "sub_123",
      currentPeriodEnd: new Date(PERIOD_END * 1000).toISOString(),
    });
  });

  it("is nobody's plan when the price carries none of our keys", async () => {
    const { toState } = await adapter();

    expect(toState(subscription({}, "someone_elses_price"))).toBeNull();
    expect(toState(subscription({}, null))).toBeNull();
  });

  it("keeps a subscription set to cancel active, ending on its last day", async () => {
    const { toState } = await adapter();
    const lastDay = PERIOD_END;
    const state = toState(subscription({ cancel_at_period_end: true, cancel_at: lastDay }));

    expect(state?.status).toBe("active");
    expect(state?.currentPeriodEnd).toBe(new Date(lastDay * 1000).toISOString());
  });

  it("reads the customer id from an expanded customer too", async () => {
    const { toState } = await adapter();
    const state = toState(subscription({ customer: { id: "cus_999" } as Stripe.Customer }));

    expect(state?.billingCustomerId).toBe("cus_999");
  });
});

describe("toDetails", () => {
  it("renews while running, and names our portal route", async () => {
    const { toDetails } = await adapter();
    const details = toDetails(subscription(), NOW);

    expect(details.cancelled).toBe(false);
    expect(details.renewsAt).toBe(new Date(PERIOD_END * 1000).toISOString());
    expect(details.endsAt).toBeNull();
    expect(details.portalUrl).toBe("/api/account/billing-portal");
    expect(details.updatePaymentUrl).toBe("/api/account/billing-portal?flow=payment");
  });

  it("ends, rather than renews, once cancelled", async () => {
    const { toDetails } = await adapter();
    const details = toDetails(subscription({ cancel_at_period_end: true, cancel_at: PERIOD_END }), NOW);

    expect(details.cancelled).toBe(true);
    expect(details.renewsAt).toBeNull();
    expect(details.endsAt).toBe(new Date(PERIOD_END * 1000).toISOString());
  });

  it("reads the card, falling back to the customer's default", async () => {
    const { toDetails } = await adapter();
    const card = { type: "card", card: { brand: "Visa", last4: "4242" } } as Stripe.PaymentMethod;

    expect(toDetails(subscription({ default_payment_method: card }), NOW).payment).toEqual({
      method: "card",
      brand: "visa",
      lastFour: "4242",
    });

    const customer = { id: "cus_123", invoice_settings: { default_payment_method: card } } as unknown as Stripe.Customer;
    expect(toDetails(subscription({ customer }), NOW).payment.lastFour).toBe("4242");
  });
});

describe("scheduledOf", () => {
  function scheduled(nextKey: string, status = "active") {
    return subscription({
      schedule: {
        id: "sub_sched_1",
        status,
        phases: [
          { start_date: PERIOD_START, end_date: PERIOD_END, items: [{ price: price("pinglide_pro_monthly") }] },
          { start_date: PERIOD_END, end_date: PERIOD_END + 2_592_000, items: [{ price: price(nextKey, "price_2") }] },
        ],
      } as unknown as Stripe.SubscriptionSchedule,
    });
  }

  it("reads the next phase as the booked downgrade", async () => {
    const { scheduledOf } = await adapter();

    expect(scheduledOf(scheduled("pinglide_starter_monthly"), NOW)).toEqual({
      plan: "starter",
      cadence: "monthly",
      at: new Date(PERIOD_END * 1000).toISOString(),
    });
  });

  it("books nothing when the next phase is what is already billed", async () => {
    const { scheduledOf } = await adapter();

    expect(scheduledOf(scheduled("pinglide_pro_monthly"), NOW)).toBeNull();
  });

  it("ignores a released schedule and a bare schedule id", async () => {
    const { scheduledOf } = await adapter();

    expect(scheduledOf(scheduled("pinglide_starter_monthly", "released"), NOW)).toBeNull();
    expect(scheduledOf(subscription({ schedule: "sub_sched_1" }), NOW)).toBeNull();
  });
});

describe("checkoutParams", () => {
  const request = { plan: "pro" as const, cadence: "yearly" as const, email: "a@example.test", userId: "user-1" };
  const ids = { priceId: "price_pro_yearly", promotionCodeId: null, customerId: null };

  it("returns the buyer outside the proxy, never to the dashboard", async () => {
    const { checkoutParams } = await adapter();
    const params = checkoutParams(request, ids);

    // SameSite=Strict: a return straight to /settings/billing answers a
    // purchase with a login form. docs/notes/auth.md.
    expect(params.success_url).toBe("https://example.test/checkout/done");
    expect(params.success_url).not.toMatch(/settings|account/);
  });

  it("sells through Managed Payments, one subscription to the plan's price", async () => {
    const { checkoutParams } = await adapter();
    const params = checkoutParams(request, ids);

    expect(params.mode).toBe("subscription");
    expect(params.managed_payments).toEqual({ enabled: true });
    expect(params.line_items).toEqual([{ price: "price_pro_yearly", quantity: 1 }]);
  });

  it("puts the account on the subscription's metadata", async () => {
    const { checkoutParams } = await adapter();

    expect(checkoutParams(request, ids).subscription_data?.metadata).toEqual({ user_id: "user-1" });
  });

  it("applies a share-link code, or offers the code box — never both", async () => {
    const { checkoutParams } = await adapter();

    const withCode = checkoutParams(request, { ...ids, promotionCodeId: "promo_1" });
    expect(withCode.discounts).toEqual([{ promotion_code: "promo_1" }]);
    expect(withCode.allow_promotion_codes).toBeUndefined();

    const without = checkoutParams(request, ids);
    expect(without.allow_promotion_codes).toBe(true);
    expect(without.discounts).toBeUndefined();
  });

  it("reuses a former subscriber's customer instead of the email", async () => {
    const { checkoutParams } = await adapter();

    const returning = checkoutParams(request, { ...ids, customerId: "cus_123" });
    expect(returning.customer).toBe("cus_123");
    expect(returning.customer_email).toBeUndefined();

    expect(checkoutParams(request, ids).customer_email).toBe("a@example.test");
  });
});

describe("bookedPhases", () => {
  it("keeps the paid price to the period's end, then moves with nothing prorated", async () => {
    const { bookedPhases } = await adapter();
    const params = bookedPhases(
      { cadence: "monthly" },
      { startDate: PERIOD_START, endDate: PERIOD_END, currentPriceId: "price_pro", quantity: 1, newPriceId: "price_starter" },
    );

    expect(params.end_behavior).toBe("release");
    expect(params.proration_behavior).toBe("none");
    expect(params.phases?.[0]).toEqual({
      items: [{ price: "price_pro", quantity: 1 }],
      start_date: PERIOD_START,
      end_date: PERIOD_END,
    });
    expect(params.phases?.[1]).toMatchObject({
      items: [{ price: "price_starter", quantity: 1 }],
      proration_behavior: "none",
      duration: { interval: "month", interval_count: 1 },
    });
  });
});

describe("toInvoicePage", () => {
  function invoice(overrides: Partial<Stripe.Invoice>): Stripe.Invoice {
    return {
      id: "in_1",
      status: "paid",
      created: PERIOD_START,
      billing_reason: "subscription_create",
      total: 1900,
      currency: "eur",
      post_payment_credit_notes_amount: 0,
      invoice_pdf: "https://pay.stripe.test/in_1.pdf",
      hosted_invoice_url: "https://pay.stripe.test/in_1",
      ...overrides,
    } as Stripe.Invoice;
  }

  it("formats the total and links the PDF", async () => {
    const { toInvoicePage } = await adapter();
    const page = toInvoicePage([invoice({})], 1);

    expect(page.invoices).toEqual([
      {
        id: "in_1",
        createdAt: new Date(PERIOD_START * 1000).toISOString(),
        reason: "initial",
        total: "€19.00",
        status: "paid",
        url: "https://pay.stripe.test/in_1.pdf",
      },
    ]);
  });

  it("drops drafts, links nothing while pending, and reads refunds from credit notes", async () => {
    const { toInvoicePage } = await adapter();
    const page = toInvoicePage(
      [
        invoice({ id: "in_draft", status: "draft" }),
        invoice({ id: "in_open", status: "open", created: PERIOD_START + 3 }),
        invoice({ id: "in_part", post_payment_credit_notes_amount: 500, created: PERIOD_START + 2 }),
        invoice({ id: "in_full", post_payment_credit_notes_amount: 1900, created: PERIOD_START + 1 }),
      ],
      1,
    );

    expect(page.invoices.map((entry) => [entry.id, entry.status, entry.url !== null])).toEqual([
      ["in_open", "pending", false],
      ["in_part", "partial_refund", true],
      ["in_full", "refunded", true],
    ]);
  });

  it("pages ten at a time, newest first, clamping the page asked for", async () => {
    const { toInvoicePage } = await adapter();
    const many = Array.from({ length: 23 }, (_, index) => invoice({ id: `in_${String(index)}`, created: PERIOD_START + index }));

    const first = toInvoicePage(many, 1);
    expect(first.lastPage).toBe(3);
    expect(first.invoices[0].id).toBe("in_22");

    const beyond = toInvoicePage(many, 9);
    expect(beyond.page).toBe(3);
    expect(beyond.invoices).toHaveLength(3);
  });
});

describe("verifyWebhook", () => {
  const body = JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_123", object: "subscription" } },
  });

  function header(payload: string, secret = SECRET) {
    return new Stripe("sk_test_123").webhooks.generateTestHeaderString({ payload, secret });
  }

  it("accepts the provider's signature over the raw body", async () => {
    const { verifyWebhook } = await adapter();

    expect(verifyWebhook(body, header(body))?.type).toBe("customer.subscription.updated");
  });

  it("refuses a body that was re-serialised after signing", async () => {
    const { verifyWebhook } = await adapter();
    const signed = header(body);

    expect(verifyWebhook(JSON.stringify(JSON.parse(body), null, 2), signed)).toBeNull();
  });

  it("refuses a wrong secret, a missing header and a garbage header", async () => {
    const { verifyWebhook } = await adapter();

    expect(verifyWebhook(body, header(body, "whsec_other"))).toBeNull();
    expect(verifyWebhook(body, null)).toBeNull();
    expect(verifyWebhook(body, "t=1,v1=nope")).toBeNull();
  });
});

describe("subscriptionIdOfEvent", () => {
  function event(object: unknown): Stripe.Event {
    return { type: "x", data: { object } } as unknown as Stripe.Event;
  }

  it("reads a subscription event's own id", async () => {
    const { subscriptionIdOfEvent } = await adapter();

    expect(subscriptionIdOfEvent(event({ object: "subscription", id: "sub_1" }))).toBe("sub_1");
  });

  it("reads an invoice's subscription from its parent", async () => {
    const { subscriptionIdOfEvent } = await adapter();

    expect(
      subscriptionIdOfEvent(
        event({ object: "invoice", id: "in_1", parent: { subscription_details: { subscription: "sub_2" } } }),
      ),
    ).toBe("sub_2");
    expect(subscriptionIdOfEvent(event({ object: "invoice", id: "in_1", parent: null }))).toBeNull();
  });

  it("finds nothing in anything else", async () => {
    const { subscriptionIdOfEvent } = await adapter();

    expect(subscriptionIdOfEvent(event({ object: "customer", id: "cus_1" }))).toBeNull();
  });
});

describe("assertSubscriptionId", () => {
  it("refuses a row left over from another provider", async () => {
    const { assertSubscriptionId } = await adapter();

    expect(assertSubscriptionId("sub_1AbC")).toBe("sub_1AbC");
    expect(() => assertSubscriptionId("123456")).toThrow();
    expect(() => assertSubscriptionId("starter")).toThrow();
    expect(() => assertSubscriptionId("sub_../customers")).toThrow();
  });
});

describe("upgradeProration", () => {
  it("puts a same-interval upgrade's difference on the next bill", async () => {
    const { upgradeProration } = await adapter();

    expect(upgradeProration({ recurring: { interval: "month" } } as Stripe.Price, "monthly")).toBe("create_prorations");
    expect(upgradeProration({ recurring: { interval: "year" } } as Stripe.Price, "yearly")).toBe("create_prorations");
  });

  it("invoices a monthly → yearly upgrade now, never a year later", async () => {
    const { upgradeProration } = await adapter();

    expect(upgradeProration({ recurring: { interval: "month" } } as Stripe.Price, "yearly")).toBe("always_invoice");
  });
});
