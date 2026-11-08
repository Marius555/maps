import { describe, expect, it, vi } from "vitest";

import { stillBilling } from "./billing-check";

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString();

const RUNNING = {
  plan: "pro" as const,
  status: "active" as const,
  billingSubscriptionId: "sub-1",
  currentPeriodEnd: FUTURE,
};

describe("stillBilling", () => {
  it("asks nobody when there is no subscription", async () => {
    const details = vi.fn();

    expect(await stillBilling(null, details)).toBe(false);
    expect(await stillBilling({ ...RUNNING, billingSubscriptionId: "" }, details)).toBe(false);
    expect(details).not.toHaveBeenCalled();
  });

  it("asks nobody when the subscription has already ended", async () => {
    const details = vi.fn();

    expect(await stillBilling({ ...RUNNING, status: "canceled" }, details)).toBe(false);
    expect(
      await stillBilling({ ...RUNNING, currentPeriodEnd: "2020-01-01T00:00:00.000Z" }, details),
    ).toBe(false);
    expect(details).not.toHaveBeenCalled();
  });

  it("refuses a running subscription that was never cancelled — the forged-stamp case", async () => {
    expect(await stillBilling(RUNNING, async () => ({ cancelled: false }))).toBe(true);
  });

  it("refuses a past-due one too, which the confirmation also cancels", async () => {
    expect(
      await stillBilling({ ...RUNNING, status: "past_due" }, async () => ({ cancelled: false })),
    ).toBe(true);
  });

  it("lets a cancelled one through, though our row still reads active", async () => {
    expect(await stillBilling(RUNNING, async () => ({ cancelled: true }))).toBe(false);
  });

  it("lets one through that the provider no longer has", async () => {
    expect(await stillBilling(RUNNING, async () => null)).toBe(false);
  });

  it("lets a provider failure propagate, so nothing is deleted on a guess", async () => {
    await expect(
      stillBilling(RUNNING, async () => {
        throw new Error("down");
      }),
    ).rejects.toThrow("down");
  });
});
