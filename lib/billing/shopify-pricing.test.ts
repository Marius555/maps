import { describe, expect, it } from "vitest";

import {
  RENEWAL_MARGIN_MS,
  planForHandle,
  toShopifyState,
  type ShopifyActiveSubscription,
} from "./shopify-pricing";

const SHOP = "demo-shop.myshopify.com";
const END = "2026-12-01T00:00:00.000Z";

function subscription(overrides: Partial<ShopifyActiveSubscription> = {}): ShopifyActiveSubscription {
  return {
    billingPeriod: "EVERY_30_DAYS",
    cancelAtEndOfCycle: false,
    trialEndsAt: null,
    currentBillingCycle: { startTime: "2026-11-01T00:00:00.000Z", endTime: END },
    items: [{ handle: "starter" }],
    ...overrides,
  };
}

const state = (sub: ShopifyActiveSubscription | null, frozen = false) =>
  toShopifyState({ workspaceId: "ws1", shop: SHOP, subscription: sub, frozen });

describe("planForHandle", () => {
  it("maps our handles, with or without a suffix", () => {
    expect(planForHandle("starter")).toBe("starter");
    expect(planForHandle("Pro")).toBe("pro");
    expect(planForHandle("pro-annual")).toBe("pro");
    expect(planForHandle("starter_2026")).toBe("starter");
  });

  it("is null for the free plan and anything unknown", () => {
    expect(planForHandle("free")).toBeNull();
    expect(planForHandle("enterprise")).toBeNull();
    expect(planForHandle("prototype")).toBeNull();
  });
});

describe("toShopifyState", () => {
  it("grants a renewing plan to the end of its cycle plus the renewal margin", () => {
    const result = state(subscription());

    expect(result).toMatchObject({
      userId: "ws1",
      plan: "starter",
      status: "active",
      cadence: "monthly",
      billingCustomerId: SHOP,
      provider: "shopify",
    });
    expect(Date.parse(result.currentPeriodEnd!)).toBe(Date.parse(END) + RENEWAL_MARGIN_MS);
  });

  it("ends a plan set to cancel exactly when Shopify says", () => {
    const result = state(subscription({ cancelAtEndOfCycle: true }));

    expect(result.status).toBe("active");
    expect(result.currentPeriodEnd).toBe(END);
  });

  it("reads yearly plans as yearly", () => {
    expect(state(subscription({ billingPeriod: "ANNUAL", items: [{ handle: "pro" }] }))).toMatchObject(
      { plan: "pro", cadence: "yearly" },
    );
  });

  it("uses the trial's end while there is no billing cycle yet", () => {
    const trialEnd = "2026-11-08T00:00:00.000Z";
    const result = state(subscription({ currentBillingCycle: null, trialEndsAt: trialEnd }));

    expect(Date.parse(result.currentPeriodEnd!)).toBe(Date.parse(trialEnd) + RENEWAL_MARGIN_MS);
  });

  it("is the free plan with nothing running when there is no subscription", () => {
    expect(state(null)).toMatchObject({
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      provider: "shopify",
    });
  });

  it("is the free plan when the subscription is to Shopify's free plan", () => {
    expect(state(subscription({ items: [{ handle: "free" }] }))).toMatchObject({
      plan: "free",
      status: "canceled",
    });
  });

  it("stops granting a frozen subscription", () => {
    expect(state(subscription(), true).status).toBe("paused");
  });
});
