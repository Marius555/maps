import { describe, expect, it } from "vitest";

import { shopifyPlanPurchase } from "./funnel";

const free = { plan: "free", status: "canceled", cadence: null } as const;
const starterMonthly = { plan: "starter", status: "active", cadence: "monthly" } as const;
const starterYearly = { plan: "starter", status: "active", cadence: "yearly" } as const;
const pro = { plan: "pro", status: "active", cadence: "monthly" } as const;

describe("shopifyPlanPurchase", () => {
  it("counts a first paid plan", () => {
    expect(shopifyPlanPurchase(free, starterMonthly)).toEqual({
      provider: "shopify",
      plan: "starter",
      cadence: "monthly",
    });
  });

  it("counts a shop with no subscription row yet", () => {
    expect(shopifyPlanPurchase(null, pro)?.plan).toBe("pro");
  });

  it("counts a move to another plan or cadence", () => {
    expect(shopifyPlanPurchase(starterMonthly, pro)?.plan).toBe("pro");
    expect(shopifyPlanPurchase(starterMonthly, starterYearly)?.cadence).toBe("yearly");
  });

  it("does not count the same plan read again", () => {
    expect(shopifyPlanPurchase(pro, pro)).toBeNull();
  });

  it("does not count a move to free, or staying free", () => {
    expect(shopifyPlanPurchase(pro, free)).toBeNull();
    expect(shopifyPlanPurchase(free, free)).toBeNull();
  });

  it("does not count a frozen plan", () => {
    expect(shopifyPlanPurchase(free, { ...pro, status: "paused" })).toBeNull();
  });

  it("counts a frozen plan coming back as a fresh purchase", () => {
    expect(shopifyPlanPurchase({ ...pro, status: "paused" }, pro)?.plan).toBe("pro");
  });
});
