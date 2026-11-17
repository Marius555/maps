import { describe, expect, it } from "vitest";

import { isDowngrade, planChange, withKeptPlan } from "./plan-change";

const NOW = Date.parse("2026-09-21T12:00:00.000Z");
const RENEWAL = "2026-10-21T19:21:57.000Z";

const proMonthly = { plan: "pro" as const, cadence: "monthly" as const };
const proYearly = { plan: "pro" as const, cadence: "yearly" as const };
const starterMonthly = { plan: "starter" as const, cadence: "monthly" as const };

describe("isDowngrade", () => {
  it("decides by plan first", () => {
    expect(isDowngrade({ plan: "pro", cadence: "monthly" }, { plan: "starter", cadence: "monthly" })).toBe(true);
    expect(isDowngrade({ plan: "starter", cadence: "monthly" }, { plan: "pro", cadence: "monthly" })).toBe(false);
    // A cheaper plan for longer is still a cheaper plan.
    expect(isDowngrade({ plan: "pro", cadence: "monthly" }, { plan: "starter", cadence: "yearly" })).toBe(true);
    expect(isDowngrade({ plan: "starter", cadence: "yearly" }, { plan: "pro", cadence: "monthly" })).toBe(false);
  });

  it("reads yearly to monthly on one plan as a step down, and the reverse as a step up", () => {
    expect(isDowngrade({ plan: "pro", cadence: "yearly" }, { plan: "pro", cadence: "monthly" })).toBe(true);
    expect(isDowngrade({ plan: "pro", cadence: "monthly" }, { plan: "pro", cadence: "yearly" })).toBe(false);
  });

  it("does not guess a step down from a cadence it never knew", () => {
    expect(isDowngrade({ plan: "pro", cadence: null }, { plan: "pro", cadence: "monthly" })).toBe(false);
  });
});

describe("withKeptPlan (retired columns)", () => {
  it("grants a kept plan until its date, then what is billed", () => {
    const kept = { plan: "pro" as const, until: RENEWAL };

    expect(withKeptPlan("starter", kept, NOW)).toBe("pro");
    expect(withKeptPlan("starter", kept, Date.parse(RENEWAL) + 1)).toBe("starter");
  });

  it("never lowers a plan and never revives one from free", () => {
    expect(withKeptPlan("pro", { plan: "starter", until: RENEWAL }, NOW)).toBe("pro");
    expect(withKeptPlan("free", { plan: "pro", until: RENEWAL }, NOW)).toBe("free");
    expect(withKeptPlan("starter", null, NOW)).toBe("starter");
  });
});

/**
 * How each press on the account page reaches the provider. The money is in the
 * kind: a downgrade made "now" would credit back a period still being used, and
 * on a change of interval Stripe would invoice the new price today.
 */
describe("planChange", () => {
  it("starts an upgrade now", () => {
    expect(planChange(proMonthly, proYearly, null)).toEqual({ kind: "now", target: proYearly });
    expect(planChange(starterMonthly, proMonthly, null)).toEqual({ kind: "now", target: proMonthly });
  });

  it("books a downgrade for the renewal", () => {
    expect(planChange(proMonthly, starterMonthly, null)).toEqual({
      kind: "renewal",
      target: starterMonthly,
    });
  });

  it("books yearly to monthly on one plan the same way", () => {
    expect(planChange(proYearly, proMonthly, null)).toEqual({ kind: "renewal", target: proMonthly });
  });

  it("undoes a booked downgrade by keeping what is billed", () => {
    expect(planChange(proMonthly, proMonthly, starterMonthly)).toEqual({ kind: "keep" });
  });

  it("replaces a booked downgrade with another one", () => {
    const starterYearly = { plan: "starter" as const, cadence: "yearly" as const };

    expect(planChange(proMonthly, starterYearly, starterMonthly)).toEqual({
      kind: "renewal",
      target: starterYearly,
    });
  });

  it("upgrades from what is paid for while a downgrade waits", () => {
    expect(planChange(proMonthly, proYearly, starterMonthly)).toEqual({ kind: "now", target: proYearly });
  });

  it("changes nothing that is already billed or already booked", () => {
    expect(planChange(proMonthly, proMonthly, null)).toEqual({ kind: "unchanged", booked: false });
    expect(planChange(proMonthly, starterMonthly, starterMonthly)).toEqual({ kind: "unchanged", booked: true });
  });
});
