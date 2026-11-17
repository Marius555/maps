import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { DiscountInput, PlanOffer } from "./types";

vi.mock("@/lib/env", () => ({
  env: { appUrl: "https://example.test", stripeSecretKey: "sk_test_123", stripeWebhookSecret: "whsec_x" },
}));

const { couponParams, promotionCodeParams, toDiscount, toRedemption } = await import("./stripe-discounts");

const BY_PRODUCT = new Map<string, PlanOffer>([
  ["prod_pro_yearly", { plan: "pro", cadence: "yearly" }],
  ["prod_starter_monthly", { plan: "starter", cadence: "monthly" }],
]);

function code(coupon: Partial<Stripe.Coupon>, overrides: Partial<Stripe.PromotionCode> = {}): Stripe.PromotionCode {
  return {
    id: "promo_1",
    object: "promotion_code",
    active: true,
    code: "SPRING20",
    created: 1_790_000_000,
    expires_at: null,
    livemode: false,
    max_redemptions: null,
    times_redeemed: 3,
    promotion: {
      type: "coupon",
      coupon: {
        id: "coupon_1",
        name: "Spring",
        percent_off: 20,
        amount_off: null,
        duration: "once",
        duration_in_months: null,
        max_redemptions: null,
        redeem_by: null,
        ...coupon,
      },
    },
    ...overrides,
  } as unknown as Stripe.PromotionCode;
}

describe("toDiscount", () => {
  it("reads a percentage code with its use count", () => {
    expect(toDiscount(code({}), BY_PRODUCT)).toMatchObject({
      id: "promo_1",
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
      otherProducts: false,
      testMode: true,
      uses: 3,
    });
  });

  it("reads a fixed amount over months, capped and expiring", () => {
    const discount = toDiscount(
      code(
        { percent_off: null, amount_off: 450, duration: "repeating", duration_in_months: 3 },
        { max_redemptions: 10, expires_at: 1_800_000_000, livemode: true },
      ),
      BY_PRODUCT,
    );

    expect(discount).toMatchObject({
      amountType: "fixed",
      amount: 450,
      duration: "repeating",
      months: 3,
      maxUses: 10,
      expiresAt: new Date(1_800_000_000 * 1000).toISOString(),
      testMode: false,
    });
  });

  it("names the plans a code is limited to, and says when it names others", () => {
    const limited = toDiscount(code({ applies_to: { products: ["prod_pro_yearly"] } }), BY_PRODUCT);
    expect(limited?.plans).toEqual([{ plan: "pro", cadence: "yearly" }]);
    expect(limited?.otherProducts).toBe(false);

    const foreign = toDiscount(code({ applies_to: { products: ["prod_someone_else"] } }), BY_PRODUCT);
    expect(foreign?.plans).toEqual([]);
    expect(foreign?.otherProducts).toBe(true);
  });

  it("is nothing without its coupon expanded", () => {
    expect(toDiscount(code({}, { promotion: { type: "coupon", coupon: "coupon_1" } }), BY_PRODUCT)).toBeNull();
  });
});

const input: DiscountInput = {
  name: "Spring launch",
  code: "SPRING20",
  amountType: "percent",
  amount: 20,
  duration: "repeating",
  months: 3,
  maxUses: 5,
  startsAt: null,
  expiresAt: "2027-01-01T00:00:00.000Z",
  plans: [{ plan: "pro", cadence: "yearly" }],
};

describe("couponParams", () => {
  it("sends only what was chosen", () => {
    expect(couponParams(input, ["prod_pro_yearly"])).toEqual({
      name: "Spring launch",
      percent_off: 20,
      duration: "repeating",
      duration_in_months: 3,
      applies_to: { products: ["prod_pro_yearly"] },
    });
  });

  it("sends a fixed amount in euro cents, and no product limit for every plan", () => {
    expect(couponParams({ ...input, amountType: "fixed", amount: 450, duration: "once", months: null }, [])).toEqual({
      name: "Spring launch",
      amount_off: 450,
      currency: "eur",
      duration: "once",
    });
  });
});

describe("promotionCodeParams", () => {
  it("puts the code, the cap and the expiry on the promotion code", () => {
    expect(promotionCodeParams(input, "coupon_1")).toMatchObject({
      promotion: { type: "coupon", coupon: "coupon_1" },
      code: "SPRING20",
      max_redemptions: 5,
      expires_at: Math.floor(Date.parse("2027-01-01T00:00:00.000Z") / 1000),
    });
  });

  it("leaves out a cap and an expiry nobody chose", () => {
    const params = promotionCodeParams({ ...input, maxUses: null, expiresAt: null }, "coupon_1");

    expect(params.max_redemptions).toBeUndefined();
    expect(params.expires_at).toBeUndefined();
  });
});

describe("toRedemption", () => {
  function session(promotionCode: string | null): Stripe.Checkout.Session {
    return {
      id: "cs_1",
      created: 1_790_000_000,
      currency: "eur",
      customer_details: { email: "buyer@example.test" },
      total_details: { amount_discount: 380 },
      discounts: promotionCode ? [{ promotion_code: promotionCode, coupon: "coupon_1" }] : [],
    } as unknown as Stripe.Checkout.Session;
  }

  it("reads a checkout that applied the code", () => {
    expect(toRedemption(session("promo_1"), "promo_1")).toEqual({
      id: "cs_1",
      createdAt: new Date(1_790_000_000 * 1000).toISOString(),
      email: "buyer@example.test",
      saved: 380,
      currency: "EUR",
    });
  });

  it("skips one that applied another code or none", () => {
    expect(toRedemption(session("promo_2"), "promo_1")).toBeNull();
    expect(toRedemption(session(null), "promo_1")).toBeNull();
  });
});
