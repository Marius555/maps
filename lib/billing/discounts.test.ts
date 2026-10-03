import { describe, expect, it } from "vitest";

import { checkoutSchema } from "@/lib/validation/billing.schema";
import { adminDiscountFormSchema, toDiscountInput } from "@/lib/validation/discount.schema";
import {
  discountAppliesTo,
  discountedEuros,
  discountNote,
  discountShareLink,
  discountStatus,
  formatDiscountAmount,
  formatEuros,
  randomDiscountCode,
} from "./discounts";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const OPEN = { startsAt: null, expiresAt: null, maxUses: null, uses: 0 };

describe("discountStatus", () => {
  it("is active with no window and no cap", () => {
    expect(discountStatus(OPEN, NOW)).toBe("active");
  });

  it("is scheduled before its start, expired after its end", () => {
    expect(discountStatus({ ...OPEN, startsAt: "2026-10-04T00:00:00Z" }, NOW)).toBe("scheduled");
    expect(discountStatus({ ...OPEN, expiresAt: "2026-10-03T11:59:00Z" }, NOW)).toBe("expired");
  });

  it("is used up at its cap, and an uncounted code is not", () => {
    expect(discountStatus({ ...OPEN, maxUses: 2, uses: 2 }, NOW)).toBe("used_up");
    expect(discountStatus({ ...OPEN, maxUses: 2, uses: null }, NOW)).toBe("active");
  });

  it("ranks expiry over everything else", () => {
    expect(
      discountStatus(
        { startsAt: "2026-11-01T00:00:00Z", expiresAt: "2026-10-01T00:00:00Z", maxUses: 1, uses: 1 },
        NOW,
      ),
    ).toBe("expired");
  });
});

describe("formatting and links", () => {
  it("writes a percentage or euros", () => {
    expect(formatDiscountAmount({ amountType: "percent", amount: 20 })).toBe("20%");
    expect(formatDiscountAmount({ amountType: "fixed", amount: 450 })).toBe("€4.50");
  });

  it("links to the pricing page with a code and never a price", () => {
    expect(discountShareLink("https://pinglide.com/", "SPRING20")).toBe(
      "https://pinglide.com/pricing?code=SPRING20",
    );
  });

  it("makes codes the provider accepts", () => {
    expect(randomDiscountCode()).toMatch(/^[A-Z0-9]{8}$/);
  });
});

describe("what a discount does to a card", () => {
  const percent = { amountType: "percent" as const, amount: 20, duration: "once" as const, months: null };
  const fixed = { amountType: "fixed" as const, amount: 2500, duration: "forever" as const, months: null };

  it("applies to every plan when it names none, and only to the named ones otherwise", () => {
    expect(discountAppliesTo({ plans: [] }, { plan: "pro", cadence: "yearly" })).toBe(true);
    expect(
      discountAppliesTo({ plans: [{ plan: "pro", cadence: "yearly" }] }, { plan: "pro", cadence: "monthly" }),
    ).toBe(false);
  });

  it("takes a percentage or euros off, to the cent and never below zero", () => {
    expect(discountedEuros(19, percent)).toBe(15.2);
    expect(discountedEuros(39, fixed)).toBe(14);
    expect(discountedEuros(19, fixed)).toBe(0);
  });

  it("writes whole euros without cents", () => {
    expect(formatEuros(14)).toBe("€14");
    expect(formatEuros(15.2)).toBe("€15.20");
  });

  it("says which payments it covers, in the cadence's terms", () => {
    expect(discountNote(percent, "monthly")).toBe("20% off your first month");
    expect(discountNote(percent, "yearly")).toBe("20% off your first year");
    expect(discountNote({ ...percent, duration: "repeating", months: 3 }, "monthly")).toBe(
      "20% off the first 3 months",
    );
    expect(discountNote({ ...percent, duration: "repeating", months: 3 }, "yearly")).toBe(
      "20% off your first year",
    );
    expect(discountNote(fixed, "yearly")).toBe("€25.00 off every payment");
  });
});

const FORM = {
  name: "Spring",
  code: " spring20 ",
  amountType: "percent" as const,
  amount: "20",
  duration: "once" as const,
  months: "3",
  maxUses: "",
  startsAt: "",
  expiresAt: "",
  plans: [],
};

describe("adminDiscountFormSchema", () => {
  it("saves a code in capitals", () => {
    expect(adminDiscountFormSchema.parse(FORM).code).toBe("SPRING20");
  });

  it("refuses spaces, symbols and a code too short", () => {
    for (const code of ["SP RING", "SALE-20", "AB"]) {
      expect(adminDiscountFormSchema.safeParse({ ...FORM, code }).success).toBe(false);
    }
  });

  it("holds a percentage to 1–100 and euros to cents", () => {
    expect(adminDiscountFormSchema.safeParse({ ...FORM, amount: "101" }).success).toBe(false);
    expect(adminDiscountFormSchema.safeParse({ ...FORM, amount: "0" }).success).toBe(false);
    expect(
      adminDiscountFormSchema.safeParse({ ...FORM, amountType: "fixed", amount: "4.505" }).success,
    ).toBe(false);
  });

  it("needs months only when repeating", () => {
    expect(adminDiscountFormSchema.safeParse({ ...FORM, months: "" }).success).toBe(true);
    expect(
      adminDiscountFormSchema.safeParse({ ...FORM, duration: "repeating", months: "" }).success,
    ).toBe(false);
  });

  it("refuses an expiry before the start", () => {
    const result = adminDiscountFormSchema.safeParse({
      ...FORM,
      startsAt: "2030-02-01T00:00:00.000Z",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("turns euros into cents and empty fields into null", () => {
    const input = toDiscountInput(
      adminDiscountFormSchema.parse({
        ...FORM,
        amountType: "fixed",
        amount: "4,50",
        maxUses: "25",
        plans: ["pro-yearly"],
      }),
    );

    expect(input).toMatchObject({
      amount: 450,
      maxUses: 25,
      months: null,
      startsAt: null,
      expiresAt: null,
      plans: [{ plan: "pro", cadence: "yearly" }],
    });
  });
});

describe("checkoutSchema's code", () => {
  it("keeps a good code, in capitals", () => {
    expect(checkoutSchema.parse({ plan: "pro", code: "spring20" }).code).toBe("SPRING20");
  });

  it("drops a malformed code instead of refusing the checkout", () => {
    const parsed = checkoutSchema.safeParse({ plan: "pro", code: "<script>" });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.code).toBeUndefined();
  });
});
