import { describe, expect, it } from "vitest";

import { billingStanding, hasLapsed } from "./standing";

const NOW = Date.parse("2026-09-21T12:00:00.000Z");

const running = {
  plan: "pro" as const,
  status: "active" as const,
  billingSubscriptionId: "sub-9",
  currentPeriodEnd: "2026-10-21T00:00:00.000Z",
};

/**
 * Which subscriptions the account page may move in place.
 *
 * The expensive mistake is in one direction: a paying subscription read as
 * `none` sends its owner to `/upgrade`, which opens a *second* subscription and
 * charges them twice. So every way a running subscription can look is pinned.
 */
describe("billingStanding", () => {
  it("moves a running subscription in place", () => {
    expect(billingStanding(running, NOW)).toBe("switchable");
    expect(billingStanding({ ...running, status: "trialing" }, NOW)).toBe("switchable");
    // Cancelled but not yet ended: the provider still runs it, so do we.
    expect(billingStanding({ ...running, currentPeriodEnd: null }, NOW)).toBe("switchable");
  });

  it("holds a subscription the provider is still deciding about", () => {
    expect(billingStanding({ ...running, status: "past_due" }, NOW)).toBe("held");
    expect(billingStanding({ ...running, status: "paused" }, NOW)).toBe("held");
  });

  it("offers a fresh checkout when there is nothing left to move", () => {
    expect(billingStanding(null, NOW)).toBe("none");
    expect(billingStanding({ ...running, billingSubscriptionId: "" }, NOW)).toBe("none");
    expect(billingStanding({ ...running, status: "canceled" }, NOW)).toBe("none");
    // An `expired` event that was never delivered: the date is the safety net.
    expect(
      billingStanding({ ...running, currentPeriodEnd: "2026-09-01T00:00:00.000Z" }, NOW),
    ).toBe("none");
  });
});

describe("hasLapsed", () => {
  it("reads absent and unparseable as still running", () => {
    expect(hasLapsed(null, NOW)).toBe(false);
    expect(hasLapsed(undefined, NOW)).toBe(false);
    expect(hasLapsed("not a date", NOW)).toBe(false);
  });

  it("lapses only once the date has passed", () => {
    expect(hasLapsed("2026-09-21T11:59:59.000Z", NOW)).toBe(true);
    expect(hasLapsed("2026-09-21T12:00:01.000Z", NOW)).toBe(false);
  });
});
