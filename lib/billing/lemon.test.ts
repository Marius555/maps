import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The three pure decisions in the billing adapter, tested without a network, a
 * database or a server.
 *
 * They are worth testing and the HTTP plumbing around them is not, because these
 * are the parts that are *silently* wrong. A broken fetch fails loudly in front
 * of somebody holding a card; a status mapped the wrong way takes a paying
 * customer's plan away three weeks later, and nothing reports it.
 */

const SECRET = "whsec-test";
const VARIANTS = {
  starter: { monthly: "111", yearly: "112" },
  pro: { monthly: "221", yearly: "222" },
};

vi.mock("@/lib/env", () => ({
  env: {
    appwriteApiKey: "test-key",
    databaseId: "test-db",
    storageId: "test-store",
    appUrl: "https://example.test",
    lemonApiKey: "key",
    lemonStoreId: "1",
    lemonWebhookSecret: SECRET,
    lemonVariants: VARIANTS,
  },
}));

beforeEach(() => {
  vi.resetModules();
});

async function lemon() {
  return import("./lemon");
}

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhook", () => {
  const body = '{"meta":{"event_name":"subscription_created"}}';

  it("accepts a body signed with the shared secret", async () => {
    const { verifyWebhook } = await lemon();

    expect(verifyWebhook(body, sign(body))).toBe(true);
  });

  it("rejects a body that was changed after signing", async () => {
    const { verifyWebhook } = await lemon();
    const signature = sign(body);

    expect(verifyWebhook(`${body} `, signature)).toBe(false);
  });

  it("rejects a signature made with a different secret", async () => {
    const { verifyWebhook } = await lemon();

    expect(verifyWebhook(body, sign(body, "someone-elses"))).toBe(false);
  });

  /*
   * `timingSafeEqual` throws on mismatched lengths rather than returning false,
   * so without the length guard a short or absent header would be a 500 instead
   * of a 401 — and a 500 is what tells a provider to retry forever.
   */
  it("returns false rather than throwing on a malformed header", async () => {
    const { verifyWebhook } = await lemon();

    expect(verifyWebhook(body, "")).toBe(false);
    expect(verifyWebhook(body, "abc")).toBe(false);
    expect(verifyWebhook(body, null)).toBe(false);
  });

  it("refuses everybody when no secret is configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: { lemonWebhookSecret: "", lemonVariants: VARIANTS },
    }));

    const { verifyWebhook } = await import("./lemon");

    // Not "skips verification". An open endpoint that writes subscription rows
    // is a free Pro plan for anyone who can POST.
    expect(verifyWebhook(body, sign(body))).toBe(false);
  });
});

describe("toStatus", () => {
  it("keeps a cancelled subscription active until it actually ends", async () => {
    const { toStatus } = await lemon();

    /*
     * The single most consequential line in this file. The provider keeps a
     * cancelled subscription running to the end of the period already paid for;
     * mapping it to `canceled` would revoke a paid plan the instant somebody
     * clicks cancel, which is both wrong and a refund request.
     */
    expect(toStatus("cancelled")).toBe("active");
  });

  it("maps the rest onto our own vocabulary", async () => {
    const { toStatus } = await lemon();

    expect(toStatus("active")).toBe("active");
    expect(toStatus("on_trial")).toBe("trialing");
    expect(toStatus("past_due")).toBe("past_due");
    expect(toStatus("paused")).toBe("paused");
    expect(toStatus("expired")).toBe("canceled");
    // The end of dunning, not the start of it: the retries are already spent.
    expect(toStatus("unpaid")).toBe("canceled");
  });

  it("treats a status it does not recognise as no subscription", async () => {
    const { toStatus } = await lemon();

    // Guessing `active` for an unknown word would give the product away on the
    // strength of a typo.
    expect(toStatus("something_new")).toBe("canceled");
    expect(toStatus("")).toBe("canceled");
  });
});

describe("planForVariant", () => {
  it("finds the plan behind a configured variant, either cadence", async () => {
    const { planForVariant } = await lemon();

    expect(planForVariant("111")).toBe("starter");
    expect(planForVariant("112")).toBe("starter");
    expect(planForVariant("221")).toBe("pro");
    expect(planForVariant("222")).toBe("pro");
  });

  it("claims nothing for a variant that is not ours", async () => {
    const { planForVariant } = await lemon();

    // Another product in the same store, or a price replaced without the
    // environment being updated. Either way it is not a plan.
    expect(planForVariant("999")).toBeNull();
    expect(planForVariant("")).toBeNull();
  });
});

describe("readWebhook", () => {
  function payload(overrides: Record<string, unknown> = {}) {
    return {
      meta: {
        event_name: "subscription_created",
        custom_data: { user_id: "user-1" },
      },
      data: {
        id: "sub-9",
        attributes: {
          status: "active",
          customer_id: 42,
          variant_id: 221,
          renews_at: "2026-10-20T00:00:00.000Z",
          ends_at: null,
          ...overrides,
        },
      },
    };
  }

  it("reads an account, a plan and a period out of a real-shaped payload", async () => {
    const { readWebhook } = await lemon();

    expect(readWebhook(payload())).toEqual({
      name: "subscription_created",
      userId: "user-1",
      state: {
        plan: "pro",
        status: "active",
        // Numbers in the payload, strings in our columns.
        billingCustomerId: "42",
        billingSubscriptionId: "sub-9",
        currentPeriodEnd: "2026-10-20T00:00:00.000Z",
      },
    });
  });

  /*
   * The pair that makes the `cancelled → active` mapping safe. A live
   * subscription has a next charge date; a cancelled one has a last day. Reading
   * the renewal date of a cancelled subscription would extend a plan somebody
   * stopped paying for.
   */
  it("prefers the end date over the renewal date when both are present", async () => {
    const { readWebhook } = await lemon();

    const event = readWebhook(
      payload({
        status: "cancelled",
        ends_at: "2026-11-01T00:00:00.000Z",
        renews_at: "2026-12-01T00:00:00.000Z",
      }),
    );

    expect(event?.state?.status).toBe("active");
    expect(event?.state?.currentPeriodEnd).toBe("2026-11-01T00:00:00.000Z");
  });

  it("names the event but claims no state for a variant that is not ours", async () => {
    const { readWebhook } = await lemon();
    const event = readWebhook(payload({ variant_id: 999 }));

    expect(event?.name).toBe("subscription_created");
    expect(event?.state).toBeNull();
  });

  /*
   * Renewals a year later may carry no custom data — it belongs to the checkout,
   * not to the charge. A null userId is the route's signal to fall back to the
   * stored customer id rather than to drop the event.
   */
  it("reports a missing account rather than inventing one", async () => {
    const { readWebhook } = await lemon();
    const body = payload();
    const event = readWebhook({ ...body, meta: { event_name: body.meta.event_name } });

    expect(event?.userId).toBeNull();
    expect(event?.state?.billingCustomerId).toBe("42");
  });

  it("declines anything that is not a webhook at all", async () => {
    const { readWebhook } = await lemon();

    // Third-party JSON off the wire: a missing key is a reason to decline the
    // event, never to throw inside a handler the provider will retry forever.
    expect(readWebhook({})).toBeNull();
    expect(readWebhook(null)).toBeNull();
    expect(readWebhook({ meta: {} })).toBeNull();
  });
});

/**
 * The two payload *shapes*, which is the distinction that actually bit.
 *
 * Seven `subscription_*` events send a subscription object; four send a
 * subscription-invoice, which has no `variant_id` and whose `status` is an
 * invoice status (`paid`, `void`, `refunded`) meaning nothing about whether the
 * subscription runs. Reading the second as the first matches no plan and logs a
 * configuration error on the most routine event in the system — and, if the
 * event were then dropped, could leave `currentPeriodEnd` stale on a renewal and
 * silently downgrade somebody whose card had just been charged.
 */
describe("invoice payloads", () => {
  const invoice = {
    meta: {
      event_name: "subscription_payment_success",
      custom_data: { user_id: "user-1" },
    },
    data: {
      id: "inv-3",
      type: "subscription-invoices",
      attributes: {
        store_id: 479090,
        subscription_id: 77,
        customer_id: 42,
        status: "paid",
        // Note what is absent: no variant_id, and no subscription status.
      },
    },
  };

  it("claims no subscription state from an invoice", async () => {
    const { readWebhook } = await lemon();
    const event = readWebhook(invoice);

    expect(event?.name).toBe("subscription_payment_success");
    expect(event?.state).toBeNull();
  });

  it("surfaces the subscription id the route refetches with", async () => {
    const { subscriptionIdOf } = await lemon();

    // A number in the payload, a string in our code — the same coercion the
    // customer and variant ids get.
    expect(subscriptionIdOf(invoice)).toBe("77");
  });

  it("finds no subscription id on a subscription payload or on junk", async () => {
    const { subscriptionIdOf } = await lemon();

    expect(subscriptionIdOf({ data: { attributes: { status: "active" } } })).toBeNull();
    expect(subscriptionIdOf(null)).toBeNull();
    expect(subscriptionIdOf({})).toBeNull();
  });
});
