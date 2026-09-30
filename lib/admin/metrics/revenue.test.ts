import { describe, expect, it } from "vitest";

import { estimateMrr, formatEuros, isPaying, monthlyValue } from "./revenue";

const NOW = new Date("2026-09-29T12:00:00Z");
const FUTURE = "2026-10-29T12:00:00Z";

describe("isPaying", () => {
  it("reads entitlement the way getUserPlan does", () => {
    expect(isPaying({ plan: "starter", status: "active", cadence: "monthly", currentPeriodEnd: FUTURE }, NOW)).toBe(true);
    expect(isPaying({ plan: "starter", status: "past_due", cadence: "monthly", currentPeriodEnd: FUTURE }, NOW)).toBe(false);
    expect(isPaying({ plan: "pro", status: "active", cadence: "monthly", currentPeriodEnd: "2026-09-01T00:00:00Z" }, NOW)).toBe(false);
    expect(isPaying({ plan: "free", status: "active", cadence: null, currentPeriodEnd: null }, NOW)).toBe(false);
  });
});

describe("monthly revenue", () => {
  it("spreads a yearly plan over twelve months", () => {
    expect(monthlyValue({ plan: "starter", status: "active", cadence: "monthly", currentPeriodEnd: null })).toBe(19);
    expect(monthlyValue({ plan: "pro", status: "active", cadence: "yearly", currentPeriodEnd: null })).toBeCloseTo(32.5);
  });

  it("counts only paying subscriptions", () => {
    expect(
      estimateMrr(
        [
          { plan: "starter", status: "active", cadence: "monthly", currentPeriodEnd: FUTURE },
          { plan: "pro", status: "active", cadence: "yearly", currentPeriodEnd: FUTURE },
          { plan: "pro", status: "canceled", cadence: "monthly", currentPeriodEnd: FUTURE },
        ],
        NOW,
      ),
    ).toBeCloseTo(51.5);
  });

  it("formats whole euros with separators", () => {
    expect(formatEuros(51.5)).toBe("€52");
    expect(formatEuros(12345)).toBe("€12,345");
  });
});
