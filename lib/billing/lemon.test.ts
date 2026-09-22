import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pure decisions in the billing adapter, tested without a network, a
 * database or a server.
 *
 * They are worth testing and the HTTP plumbing around them is not, because these
 * are the parts that are *silently* wrong. A broken fetch fails loudly in front
 * of somebody holding a card; a status mapped the wrong way takes a paying
 * customer's plan away three weeks later, and nothing reports it.
 *
 * `createCheckout` is the one exception, and it earns its place by that same
 * test: the request it builds carries the URL a buyer is returned to, and
 * sending them to the wrong one is invisible from here — the checkout opens, the
 * payment succeeds, the money arrives, and only the customer ever sees what went
 * wrong. See the last describe block.
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

describe("offerForVariant", () => {
  it("finds the plan and the cadence behind a configured variant", async () => {
    const { offerForVariant } = await lemon();

    expect(offerForVariant("111")).toEqual({ plan: "starter", cadence: "monthly" });
    expect(offerForVariant("112")).toEqual({ plan: "starter", cadence: "yearly" });
    expect(offerForVariant("221")).toEqual({ plan: "pro", cadence: "monthly" });
    expect(offerForVariant("222")).toEqual({ plan: "pro", cadence: "yearly" });
  });

  it("claims nothing for a variant that is not ours", async () => {
    const { offerForVariant } = await lemon();

    // Another product in the same store, or a price replaced without the
    // environment being updated. Either way it is not a plan.
    expect(offerForVariant("999")).toBeNull();
    expect(offerForVariant("")).toBeNull();
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
        cadence: "monthly",
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

/**
 * Whether a failed refetch should bring the event back.
 *
 * The route answers 200 to what it cannot act on and 5xx to what it merely
 * failed at, because a non-2xx is how the provider is told to redeliver. That
 * makes this function's failure mode a routing decision rather than an error
 * detail: a subscription the provider says does not exist will not exist on the
 * next attempt either, and returning 5xx for it queues an event to fail
 * identically forever.
 */
describe("fetchSubscriptionState", () => {
  beforeEach(() => {
    vi.doMock("@/lib/env", () => ({
      env: {
        appUrl: "https://example.test",
        lemonApiKey: "key",
        lemonStoreId: "1",
        lemonWebhookSecret: SECRET,
        lemonVariants: VARIANTS,
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a live subscription into our own state", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        data: {
          id: "sub-9",
          attributes: {
            status: "active",
            customer_id: 42,
            variant_id: 221,
            renews_at: "2026-10-20T00:00:00.000Z",
            ends_at: null,
          },
        },
      }),
    );

    const { fetchSubscriptionState } = await lemon();

    expect(await fetchSubscriptionState("sub-9")).toEqual({
      plan: "pro",
      status: "active",
      billingCustomerId: "42",
      billingSubscriptionId: "sub-9",
      currentPeriodEnd: "2026-10-20T00:00:00.000Z",
      cadence: "monthly",
    });
  });

  it("treats a subscription the provider does not have as no state", async () => {
    vi.stubGlobal("fetch", async () => new Response("not found", { status: 404 }));

    const { fetchSubscriptionState } = await lemon();

    // Null, not a throw. The route turns this into 200 + handled:false, so the
    // event is not redelivered to fail the same way forever.
    expect(await fetchSubscriptionState("gone")).toBeNull();
  });

  it("still throws when the provider is merely broken", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 503 }));

    const { fetchSubscriptionState, BillingError } = await lemon();

    // The opposite direction: this one *should* come back, so it has to reach
    // the route's catch and become a 5xx.
    await expect(fetchSubscriptionState("sub-9")).rejects.toBeInstanceOf(BillingError);
  });

  it("asks nothing when there is no id to ask about", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { fetchSubscriptionState } = await lemon();

    expect(await fetchSubscriptionState("")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * Where a buyer is sent back to, which is a cookie decision wearing a URL.
 *
 * The session cookie is `sameSite: "strict"`, so a browser returning from the
 * provider's domain withholds it — and carries that through any server redirect
 * chain. A `redirect_url` pointing anywhere inside `proxy.ts`'s matcher
 * therefore reaches the proxy with no cookie visible and answers a completed
 * purchase with a login form.
 *
 * This is asserted rather than left to review because **nothing downstream can
 * catch it.** The checkout opens, the card is charged, the webhook grants the
 * plan; every measurement we have says the sale worked. The failure lives
 * entirely in one bounce of one browser, and it already shipped once.
 */
describe("createCheckout", () => {
  /*
   * The env is re-declared rather than inherited, and that is not belt and
   * braces. "refuses everybody when no secret is configured" above registers a
   * `doMock` with a deliberately bare env, and **that registration outlives the
   * test**: `resetModules()` clears the module cache, not the mock registry. The
   * blocks between here and there happen to only read `lemonVariants`, which
   * that bare env supplies, so nothing has noticed yet.
   */
  beforeEach(() => {
    vi.doMock("@/lib/env", () => ({
      env: {
        appUrl: "https://example.test",
        lemonApiKey: "key",
        lemonStoreId: "1",
        lemonWebhookSecret: SECRET,
        lemonVariants: VARIANTS,
      },
    }));
  });

  function mockCheckout() {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { attributes: { url: "https://pay.test/abc" } } }),
    );

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function sentBody(fetchMock: ReturnType<typeof mockCheckout>) {
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    return JSON.parse(String(init.body)) as {
      data: {
        attributes: {
          checkout_data: { email: string; custom: { user_id: string } };
          product_options: { redirect_url: string };
        };
        relationships: { variant: { data: { id: string } } };
      };
    };
  }

  it("returns the buyer to a page outside the proxy's matcher", async () => {
    const fetchMock = mockCheckout();
    const { createLemonProvider } = await lemon();

    await createLemonProvider().createCheckout({
      plan: "pro",
      cadence: "yearly",
      email: "buyer@example.test",
      userId: "user-1",
    });

    const { redirect_url } = (await sentBody(fetchMock)).data.attributes
      .product_options;

    /*
     * `proxy.ts`'s matcher, spelled out. If a path is added there, this is the
     * other place that has to know — and a failure here is the cheapest possible
     * way to find that out.
     */
    expect(redirect_url).not.toMatch(/\/(account|maps)(\/|\?|$)/);
    expect(redirect_url).toBe("https://example.test/checkout/done");
  });

  it("sends the variant for the plan and cadence that were asked for", async () => {
    const fetchMock = mockCheckout();
    const { createLemonProvider } = await lemon();

    await createLemonProvider().createCheckout({
      plan: "starter",
      cadence: "yearly",
      email: "buyer@example.test",
      userId: "user-1",
    });

    const body = await sentBody(fetchMock);

    // Yearly, not the monthly variant of the same plan. The two ids differing is
    // the whole reason the cadence is carried this far, and crossing them charges
    // a year's customer one month's price.
    expect(body.data.relationships.variant.data.id).toBe(VARIANTS.starter.yearly);
    // The only link between a payment and an account — see the webhook reader.
    expect(body.data.attributes.checkout_data.custom.user_id).toBe("user-1");
  });
});

/**
 * Moving a subscription that already exists.
 *
 * The request is asserted rather than trusted for the same reason the checkout's
 * is: a wrong one is invisible from here. Sending the monthly variant of a plan
 * the customer asked to pay yearly for succeeds, prorates, and charges them the
 * wrong price on every renewal after — and the method matters as much as the
 * body, because a POST to the same path is not a change of plan.
 */
describe("changePlan", () => {
  beforeEach(() => {
    vi.doMock("@/lib/env", () => ({
      env: {
        appUrl: "https://example.test",
        lemonApiKey: "key",
        lemonStoreId: "1",
        lemonWebhookSecret: SECRET,
        lemonVariants: VARIANTS,
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockUpdated(variantId: number) {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: {
          id: "sub-9",
          attributes: {
            status: "active",
            customer_id: 42,
            variant_id: variantId,
            renews_at: "2026-10-20T00:00:00.000Z",
            ends_at: null,
          },
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  it("patches the one subscription with the variant for the plan and cadence asked for", async () => {
    const fetchMock = mockUpdated(222);
    const { createLemonProvider } = await lemon();

    await createLemonProvider().changePlan({
      billingSubscriptionId: "sub-9",
      plan: "pro",
      cadence: "yearly",
      prorate: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      data: { type: string; id: string; attributes: Record<string, unknown> };
    };

    expect(init.method).toBe("PATCH");
    expect(url).toMatch(/\/subscriptions\/sub-9$/);
    expect(body.data.type).toBe("subscriptions");
    expect(body.data.id).toBe("sub-9");
    // The variant alone: proration is left at the provider's default, onto the
    // next renewal, and nothing is invoiced on the spot.
    expect(body.data.attributes).toEqual({ variant_id: Number(VARIANTS.pro.yearly) });
  });

  it("switches proration off for a change that waits for the renewal", async () => {
    // A downgrade, or undoing one: the period already paid for is kept rather
    // than credited, so the provider must neither refund nor charge for it —
    // the next renewal is simply the new price.
    const fetchMock = mockUpdated(111);
    const { createLemonProvider } = await lemon();

    await createLemonProvider().changePlan({
      billingSubscriptionId: "sub-9",
      plan: "starter",
      cadence: "monthly",
      prorate: false,
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      data: { attributes: Record<string, unknown> };
    };

    expect(body.data.attributes).toEqual({
      variant_id: Number(VARIANTS.starter.monthly),
      disable_prorations: true,
    });
    // Never both: the provider lets `disable_prorations` win, and a card must
    // not be charged on the spot from one press either way.
    expect(body.data.attributes).not.toHaveProperty("invoice_immediately");
  });

  it("reads the reply through the same state the webhook writes", async () => {
    mockUpdated(112);
    const { createLemonProvider } = await lemon();

    const state = await createLemonProvider().changePlan({
      billingSubscriptionId: "sub-9",
      plan: "starter",
      cadence: "yearly",
      prorate: true,
    });

    expect(state).toEqual({
      plan: "starter",
      cadence: "yearly",
      status: "active",
      billingCustomerId: "42",
      billingSubscriptionId: "sub-9",
      currentPeriodEnd: "2026-10-20T00:00:00.000Z",
    });
  });

  it("throws when the provider refuses, rather than reporting a change that did not happen", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 422 }));
    const { createLemonProvider, BillingError } = await lemon();

    await expect(
      createLemonProvider().changePlan({
        billingSubscriptionId: "sub-9",
        plan: "pro",
        cadence: "monthly",
        prorate: true,
      }),
    ).rejects.toBeInstanceOf(BillingError);
  });
});
