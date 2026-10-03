import { describe, expect, it } from "vitest";

import type { PlanOffer, PublicDiscount } from "@/lib/billing/types";

import { RECOMMENDED_PLAN } from "./plans";
import { cadenceForDiscount, recommendedPlan } from "./recommended-plan";

function code(plans: PlanOffer[]): PublicDiscount {
  return {
    code: "SPRING20",
    amountType: "percent",
    amount: 30,
    duration: "once",
    months: null,
    plans,
    expiresAt: null,
  } as PublicDiscount;
}

describe("recommendedPlan", () => {
  it("keeps the default with no discount", () => {
    expect(recommendedPlan(null, "monthly")).toBe(RECOMMENDED_PLAN);
  });

  it("moves to the one paid plan the code covers", () => {
    expect(recommendedPlan(code([{ plan: "pro", cadence: "monthly" }]), "monthly")).toBe("pro");
    expect(recommendedPlan(code([{ plan: "starter", cadence: "yearly" }]), "yearly")).toBe("starter");
  });

  it("keeps the default when every paid plan is covered", () => {
    expect(recommendedPlan(code([]), "monthly")).toBe(RECOMMENDED_PLAN);
    expect(
      recommendedPlan(
        code([
          { plan: "starter", cadence: "monthly" },
          { plan: "pro", cadence: "monthly" },
        ]),
        "monthly",
      ),
    ).toBe(RECOMMENDED_PLAN);
  });

  it("reads the cadence on screen", () => {
    const proMonthly = code([{ plan: "pro", cadence: "monthly" }]);

    expect(recommendedPlan(proMonthly, "yearly")).toBe(RECOMMENDED_PLAN);
  });
});

describe("cadenceForDiscount", () => {
  it("moves to the only cadence the code covers", () => {
    expect(cadenceForDiscount(code([{ plan: "pro", cadence: "yearly" }]), "monthly")).toBe("yearly");
    expect(cadenceForDiscount(code([{ plan: "starter", cadence: "monthly" }]), "yearly")).toBe("monthly");
  });

  it("stays when the code covers something at the current cadence", () => {
    expect(
      cadenceForDiscount(
        code([
          { plan: "starter", cadence: "monthly" },
          { plan: "pro", cadence: "yearly" },
        ]),
        "monthly",
      ),
    ).toBe("monthly");
  });

  it("stays for a code covering every plan", () => {
    expect(cadenceForDiscount(code([]), "monthly")).toBe("monthly");
    expect(cadenceForDiscount(code([]), "yearly")).toBe("yearly");
  });
});
