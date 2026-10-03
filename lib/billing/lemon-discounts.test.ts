import { afterEach, describe, expect, it, vi } from "vitest";

import type { DiscountInput } from "./types";

/**
 * Discount codes at the provider: the request a create sends, and how a
 * discount read back is understood. Asserted for the reason `lemon.test.ts`
 * gives — a wrong request succeeds. A fixed amount sent in euros instead of
 * cents is a code worth a hundredth of what was meant, and nothing says so
 * until a customer pays full price.
 */

const VARIANTS = {
  starter: { monthly: "111", yearly: "112" },
  pro: { monthly: "221", yearly: "222" },
};

vi.mock("@/lib/env", () => ({
  env: { lemonApiKey: "key", lemonStoreId: "7", lemonVariants: VARIANTS },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE: DiscountInput = {
  name: "Spring",
  code: "SPRING20",
  amountType: "percent",
  amount: 20,
  duration: "once",
  months: null,
  maxUses: null,
  startsAt: null,
  expiresAt: null,
  plans: [],
};

describe("discountRequestBody", () => {
  it("leaves every unchosen option out, rather than sending its default", async () => {
    const { discountRequestBody } = await import("./lemon-discounts");
    const body = discountRequestBody(BASE);

    expect(body.data.attributes).toEqual({
      name: "Spring",
      code: "SPRING20",
      amount: 20,
      amount_type: "percent",
      duration: "once",
    });
    expect(body.data.relationships).toEqual({ store: { data: { type: "stores", id: "7" } } });
  });

  it("sends the limits, the window, the months and the plans' variants", async () => {
    const { discountRequestBody } = await import("./lemon-discounts");
    const body = discountRequestBody({
      ...BASE,
      amountType: "fixed",
      amount: 450,
      duration: "repeating",
      months: 3,
      maxUses: 50,
      startsAt: "2026-11-01T00:00:00.000Z",
      expiresAt: "2026-12-01T00:00:00.000Z",
      plans: [
        { plan: "pro", cadence: "yearly" },
        { plan: "starter", cadence: "monthly" },
      ],
    });

    expect(body.data.attributes).toMatchObject({
      amount: 450,
      amount_type: "fixed",
      duration: "repeating",
      duration_in_months: 3,
      is_limited_redemptions: true,
      max_redemptions: 50,
      starts_at: "2026-11-01T00:00:00.000Z",
      expires_at: "2026-12-01T00:00:00.000Z",
      is_limited_to_products: true,
    });
    expect(body.data.relationships.variants?.data).toEqual([
      { type: "variants", id: "222" },
      { type: "variants", id: "111" },
    ]);
  });
});

describe("toDiscount", () => {
  it("reads a limited discount's variants back as our plans", async () => {
    const { toDiscount } = await import("./lemon-discounts");
    const discount = toDiscount(
      {
        id: 9,
        attributes: {
          name: "Launch",
          code: "LAUNCH",
          amount: 500,
          amount_type: "fixed",
          is_limited_to_products: true,
          is_limited_redemptions: true,
          max_redemptions: 10,
          duration: "forever",
          test_mode: true,
          created_at: "2026-10-01T00:00:00.000Z",
        },
        relationships: { variants: { data: [{ type: "variants", id: 221 }, { id: "999" }] } },
      },
      4,
    );

    expect(discount).toMatchObject({
      id: "9",
      amountType: "fixed",
      amount: 500,
      duration: "forever",
      months: null,
      maxUses: 10,
      uses: 4,
      testMode: true,
      plans: [{ plan: "pro", cadence: "monthly" }],
      // 999 is none of ours, and the row must not read as "Pro monthly" alone.
      otherProducts: true,
    });
  });

  it("reads an unlimited, unrestricted discount as every plan, no cap", async () => {
    const { toDiscount } = await import("./lemon-discounts");
    const discount = toDiscount(
      { id: "1", attributes: { code: "A1B", amount: 10, amount_type: "percent", max_redemptions: 0 } },
      0,
    );

    expect(discount).toMatchObject({ plans: [], otherProducts: false, maxUses: null });
  });
});

describe("listDiscountRedemptions", () => {
  it("takes the buyer from an included order, and asks for one that was not", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/discount-redemptions")) {
        return Response.json({
          data: [
            { id: 1, attributes: { order_id: 10, amount: 380, created_at: "2026-10-02T00:00:00Z" } },
            { id: 2, attributes: { order_id: 11, amount: 500, created_at: "2026-10-01T00:00:00Z" } },
          ],
          included: [
            { type: "orders", id: "10", attributes: { user_email: "a@x.test", currency: "EUR" } },
          ],
          meta: { page: { currentPage: 1, lastPage: 2 } },
        });
      }

      return Response.json({ data: { attributes: { user_email: "b@x.test", currency: "USD" } } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { listDiscountRedemptions } = await import("./lemon-discounts");
    const page = await listDiscountRedemptions("5", 1);

    expect(page.lastPage).toBe(2);
    expect(page.redemptions).toEqual([
      { id: "1", createdAt: "2026-10-02T00:00:00Z", saved: 380, email: "a@x.test", currency: "EUR" },
      { id: "2", createdAt: "2026-10-01T00:00:00Z", saved: 500, email: "b@x.test", currency: "USD" },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
      "https://api.lemonsqueezy.com/v1/orders/11",
    );
  });

  it("refuses an id that is not the provider's before it reaches a URL", async () => {
    const { listDiscountRedemptions } = await import("./lemon-discounts");

    await expect(listDiscountRedemptions("../stores/1", 1)).rejects.toMatchObject({ status: 404 });
  });
});
