import { z } from "zod";

import { offerFromKey, PLAN_OFFER_KEYS, type PlanOfferKey } from "@/lib/billing/discounts";
import type { DiscountInput } from "@/lib/billing/types";

/**
 * A discount code, as the operator console writes one. docs/notes/billing.md,
 * "Discounts".
 *
 * Every number arrives as the text the operator typed, because React Aria owns
 * the inputs (`form-field.tsx`) and an empty field means something — unlimited,
 * no start, never expires. `toDiscountInput` turns the checked form into the
 * provider-neutral `DiscountInput`, euros into cents.
 *
 * The same schema checks the form and the request: the form converts its two
 * wall-clock dates to ISO before sending, and `optionalDate` accepts both.
 */

/**
 * What the provider accepts as a code (upper-case letters and digits, at least
 * three), with an upper bound of ours — nobody types 256 characters at a checkout.
 */
export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9]{3,64}$/;

const PERCENT = /^\d{1,3}$/;
const EUROS = /^\d{1,5}(?:[.,]\d{1,2})?$/;
const WHOLE = /^\d{1,7}$/;

const MAX_MONTHS = 36;
const MAX_FIXED_CENTS = 1_000_000;

const optionalDate = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Enter a date and time.");

export const adminDiscountFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name the discount.").max(100, "Keep the name under 100 characters."),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(DISCOUNT_CODE_PATTERN, "Use 3–64 letters and digits, with no spaces."),
    amountType: z.enum(["percent", "fixed"]),
    amount: z.string().trim().max(12),
    duration: z.enum(["once", "repeating", "forever"]),
    months: z.string().trim().max(4),
    maxUses: z.string().trim().max(9),
    startsAt: optionalDate,
    expiresAt: optionalDate,
    plans: z
      .array(z.enum(PLAN_OFFER_KEYS as [PlanOfferKey, ...PlanOfferKey[]]))
      .max(PLAN_OFFER_KEYS.length),
  })
  .superRefine((input, ctx) => {
    if (input.amountType === "percent") {
      const percent = Number(input.amount);
      if (!PERCENT.test(input.amount) || percent < 1 || percent > 100) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a whole percentage from 1 to 100." });
      }
    } else {
      const cents = toCents(input.amount);
      if (!EUROS.test(input.amount) || cents < 1 || cents > MAX_FIXED_CENTS) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount in euros, like 5 or 4.50." });
      }
    }

    if (input.duration === "repeating") {
      const months = Number(input.months);
      if (!WHOLE.test(input.months) || months < 1 || months > MAX_MONTHS) {
        ctx.addIssue({ code: "custom", path: ["months"], message: `Enter 1 to ${String(MAX_MONTHS)} months.` });
      }
    }

    if (input.maxUses !== "" && (!WHOLE.test(input.maxUses) || Number(input.maxUses) < 1)) {
      ctx.addIssue({ code: "custom", path: ["maxUses"], message: "Enter a whole number, or leave it empty for no limit." });
    }

    const starts = input.startsAt ? Date.parse(input.startsAt) : Date.now();
    if (input.expiresAt && Date.parse(input.expiresAt) <= starts) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: input.startsAt ? "Set the expiry after the start." : "Set the expiry in the future.",
      });
    }
  });

export type AdminDiscountForm = z.infer<typeof adminDiscountFormSchema>;

/** "4.50" or "4,50" → 450. */
function toCents(euros: string): number {
  return Math.round(Number(euros.replace(",", ".")) * 100);
}

function toIsoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** A checked form as the provider-neutral input `createDiscount` takes. */
export function toDiscountInput(form: AdminDiscountForm): DiscountInput {
  return {
    name: form.name,
    code: form.code,
    amountType: form.amountType,
    amount: form.amountType === "percent" ? Number(form.amount) : toCents(form.amount),
    duration: form.duration,
    months: form.duration === "repeating" ? Number(form.months) : null,
    maxUses: form.maxUses === "" ? null : Number(form.maxUses),
    startsAt: toIsoOrNull(form.startsAt),
    expiresAt: toIsoOrNull(form.expiresAt),
    plans: form.plans.map(offerFromKey),
  };
}
