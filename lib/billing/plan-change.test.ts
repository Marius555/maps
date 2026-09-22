import { describe, expect, it } from "vitest";

import {
  isDowngrade,
  paidOffer,
  pendingKept,
  planChange,
  withKeptPlan,
} from "./plan-change";

const NOW = Date.parse("2026-09-21T12:00:00.000Z");
const RENEWAL = "2026-10-21T19:21:57.000Z";
const PAST = "2026-09-01T00:00:00.000Z";

const proMonthly = { plan: "pro" as const, cadence: "monthly" as const, kept: null };

/** Pro paid for until the renewal; the provider already bills Starter. */
const downgraded = {
  plan: "starter" as const,
  cadence: "monthly" as const,
  kept: { plan: "pro" as const, cadence: "monthly" as const, until: RENEWAL },
};

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

describe("pendingKept and paidOffer", () => {
  it("reads a kept plan as pending until its renewal", () => {
    expect(pendingKept(downgraded, NOW)).toEqual(downgraded.kept);
    expect(paidOffer(downgraded, NOW)).toEqual({ plan: "pro", cadence: "monthly" });
  });

  it("lets a kept plan lapse at the renewal without anybody sweeping it", () => {
    const renewed = { ...downgraded, kept: { ...downgraded.kept, until: PAST } };

    expect(pendingKept(renewed, NOW)).toBeNull();
    expect(paidOffer(renewed, NOW)).toEqual({ plan: "starter", cadence: "monthly" });
  });

  it("treats an unreadable date as nothing pending, not as for ever", () => {
    const broken = { ...downgraded, kept: { ...downgraded.kept, until: "not a date" } };

    expect(pendingKept(broken, NOW)).toBeNull();
  });

  it("finds nothing pending when the kept plan is what is already billed", () => {
    expect(pendingKept({ ...downgraded, plan: "pro" }, NOW)).toBeNull();
    expect(pendingKept(proMonthly, NOW)).toBeNull();
    expect(pendingKept(null, NOW)).toBeNull();
  });
});

describe("withKeptPlan", () => {
  it("grants the plan paid for until the renewal, then what is billed", () => {
    const kept = { plan: "pro" as const, until: RENEWAL };

    expect(withKeptPlan("starter", kept, NOW)).toBe("pro");
    expect(withKeptPlan("starter", kept, Date.parse(RENEWAL) + 1)).toBe("starter");
  });

  it("never lowers a plan and never revives one from free", () => {
    expect(withKeptPlan("pro", { plan: "starter", until: RENEWAL }, NOW)).toBe("pro");
    // An ended or refused subscription grants nothing, whatever was booked on it.
    expect(withKeptPlan("free", { plan: "pro", until: RENEWAL }, NOW)).toBe("free");
    expect(withKeptPlan("starter", null, NOW)).toBe("starter");
  });
});

/**
 * How each press on the account page reaches the provider.
 *
 * The money is in the `prorate` flags. Prorating a downgrade would credit back
 * a period the customer is still using; prorating the undo of one would charge
 * them a second time for a plan they already paid for.
 */
describe("planChange", () => {
  it("starts an upgrade now, prorated, with nothing kept", () => {
    expect(planChange(proMonthly, { plan: "pro", cadence: "yearly" }, NOW)).toEqual({
      kind: "change",
      steps: [{ plan: "pro", cadence: "yearly", prorate: true }],
      keep: null,
    });
  });

  it("books a downgrade for the renewal: unprorated, keeping what was paid", () => {
    expect(planChange(proMonthly, { plan: "starter", cadence: "monthly" }, NOW)).toEqual({
      kind: "change",
      steps: [{ plan: "starter", cadence: "monthly", prorate: false }],
      // No date yet: the route takes the renewal from the provider's answer.
      keep: { plan: "pro", cadence: "monthly", until: null },
    });
  });

  it("books yearly to monthly on one plan the same way", () => {
    const yearly = { plan: "pro" as const, cadence: "yearly" as const, kept: null };

    expect(planChange(yearly, { plan: "pro", cadence: "monthly" }, NOW)).toEqual({
      kind: "change",
      steps: [{ plan: "pro", cadence: "monthly", prorate: false }],
      keep: { plan: "pro", cadence: "yearly", until: null },
    });
  });

  it("undoes a pending downgrade at no charge", () => {
    expect(planChange(downgraded, { plan: "pro", cadence: "monthly" }, NOW)).toEqual({
      kind: "change",
      steps: [{ plan: "pro", cadence: "monthly", prorate: false }],
      keep: null,
    });
  });

  it("keeps the same paid plan and date through a second downgrade", () => {
    expect(planChange(downgraded, { plan: "starter", cadence: "yearly" }, NOW)).toEqual({
      kind: "change",
      steps: [{ plan: "starter", cadence: "yearly", prorate: false }],
      keep: downgraded.kept,
    });
  });

  it("prorates an upgrade from what was paid, not from the pending plan", () => {
    // Prorating up from Starter would charge again for the Pro month already paid.
    expect(planChange(downgraded, { plan: "pro", cadence: "yearly" }, NOW)).toEqual({
      kind: "change",
      steps: [
        { plan: "pro", cadence: "monthly", prorate: false },
        { plan: "pro", cadence: "yearly", prorate: true },
      ],
      keep: null,
    });
  });

  it("changes nothing the provider already bills", () => {
    expect(planChange(proMonthly, { plan: "pro", cadence: "monthly" }, NOW)).toEqual({ kind: "unchanged" });
    expect(planChange(downgraded, { plan: "starter", cadence: "monthly" }, NOW)).toEqual({ kind: "unchanged" });
  });

  it("forgets a downgrade whose renewal has passed", () => {
    const renewed = { ...downgraded, kept: { ...downgraded.kept, until: PAST } };

    // Starter → Pro is now a plain upgrade from what is billed, with no restore.
    expect(planChange(renewed, { plan: "pro", cadence: "monthly" }, NOW)).toEqual({
      kind: "change",
      steps: [{ plan: "pro", cadence: "monthly", prorate: true }],
      keep: null,
    });
  });
});
