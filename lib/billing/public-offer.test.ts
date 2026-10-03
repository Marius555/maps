import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Discount } from "./types";

/**
 * What the public pricing page is told about discounts. The two things that
 * must hold: a code is applied only while it is live, and a busy page is not
 * a request to the payment provider per visitor.
 */

const listDiscountsBare = vi.fn<() => Promise<Discount[]>>();
const countRedemptions = vi.fn<(id: string) => Promise<number | null>>();
const getPromotion = vi.fn();

vi.mock("./lemon-discounts", () => ({ listDiscountsBare, countRedemptions }));
vi.mock("@/lib/repositories/promotions.repository", () => ({ getPromotion }));

const NOW = Date.parse("2026-10-03T12:00:00Z");

function discount(overrides: Partial<Discount>): Discount {
  return {
    id: "1",
    name: "Internal name",
    code: "SPRING20",
    amountType: "percent",
    amount: 20,
    duration: "once",
    months: null,
    maxUses: null,
    startsAt: null,
    expiresAt: null,
    plans: [],
    createdAt: "2026-10-01T00:00:00Z",
    uses: null,
    otherProducts: false,
    testMode: false,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  getPromotion.mockResolvedValue(null);
  countRedemptions.mockResolvedValue(0);
  (await import("./public-offer")).resetPricingOfferCache();
});

describe("pricingOffer", () => {
  it("applies a live code, matched whatever its case, and shows none of the operator's fields", async () => {
    listDiscountsBare.mockResolvedValue([discount({})]);
    const { pricingOffer } = await import("./public-offer");

    const offer = await pricingOffer("spring20", NOW);

    expect(offer.codeError).toBeNull();
    expect(offer.code).toEqual({
      code: "SPRING20",
      amountType: "percent",
      amount: 20,
      duration: "once",
      months: null,
      plans: [],
      expiresAt: null,
    });
  });

  it("says why a code is not applied", async () => {
    listDiscountsBare.mockResolvedValue([
      discount({ id: "1", code: "OLD", expiresAt: "2026-10-01T00:00:00Z" }),
      discount({ id: "2", code: "SOON", startsAt: "2026-11-01T00:00:00Z" }),
      discount({ id: "3", code: "GONE", maxUses: 5 }),
    ]);
    countRedemptions.mockResolvedValue(5);
    const { pricingOffer } = await import("./public-offer");

    expect((await pricingOffer("NOPE", NOW)).codeError).toBe("That code isn't valid.");
    expect((await pricingOffer("OLD", NOW)).codeError).toBe("That code has expired.");
    expect((await pricingOffer("SOON", NOW)).codeError).toBe("That code isn't active yet.");
    expect((await pricingOffer("GONE", NOW)).codeError).toBe("That code has been used up.");
  });

  it("shows the featured promotion only while its discount is live", async () => {
    listDiscountsBare.mockResolvedValue([
      discount({ id: "7", code: "LAUNCH", expiresAt: "2026-10-01T00:00:00Z" }),
    ]);
    getPromotion.mockResolvedValue({ discountId: "7", code: "LAUNCH", featuredAt: "" });
    const { pricingOffer } = await import("./public-offer");

    expect((await pricingOffer(null, NOW)).featured).toBeNull();
  });

  it("asks the provider once a minute, not once a visitor", async () => {
    listDiscountsBare.mockResolvedValue([discount({ maxUses: 10 })]);
    const { pricingOffer } = await import("./public-offer");

    for (let visit = 0; visit < 5; visit++) await pricingOffer("SPRING20", NOW + visit * 1000);

    expect(listDiscountsBare).toHaveBeenCalledTimes(1);
    expect(countRedemptions).toHaveBeenCalledTimes(1);

    await pricingOffer("SPRING20", NOW + 61_000);

    expect(listDiscountsBare).toHaveBeenCalledTimes(2);
  });

  it("does not remember a failure, and still answers the page", async () => {
    listDiscountsBare.mockRejectedValueOnce(new Error("down")).mockResolvedValue([discount({})]);
    const { pricingOffer } = await import("./public-offer");

    const first = await pricingOffer("SPRING20", NOW);
    expect(first.code).toBeNull();
    expect(first.codeError).toMatch(/Couldn't check that code/);
    expect(first.codeUnchecked).toBe(true);

    expect((await pricingOffer("SPRING20", NOW + 1000)).code?.code).toBe("SPRING20");
  });
});
