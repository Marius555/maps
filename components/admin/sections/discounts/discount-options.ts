import type { SelectOption } from "@/components/ui/select-control";
import { offerKey } from "@/lib/billing/discounts";
import type { Discount, DiscountStatus } from "@/lib/billing/types";
import { isoToWallClock } from "@/lib/format/wall-clock";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";

export const EMPTY_DISCOUNT: AdminDiscountForm = {
  name: "",
  code: "",
  amountType: "percent",
  amount: "",
  duration: "once",
  months: "3",
  maxUses: "",
  startsAt: "",
  expiresAt: "",
  plans: [],
};

export const AMOUNT_TYPE_OPTIONS: SelectOption[] = [
  { id: "percent", label: "Percentage off" },
  { id: "fixed", label: "Amount off (€)" },
];

export const DURATION_OPTIONS: SelectOption[] = [
  { id: "once", label: "First payment only" },
  { id: "repeating", label: "First few months" },
  { id: "forever", label: "Every payment" },
];

export const STATUS_STYLE: Record<
  DiscountStatus,
  { label: string; color: "success" | "accent" | "default" | "warning" }
> = {
  active: { label: "Active", color: "success" },
  scheduled: { label: "Scheduled", color: "accent" },
  used_up: { label: "Used up", color: "warning" },
  expired: { label: "Expired", color: "default" },
};

/**
 * A discount as the create form's values, for Duplicate — the provider cannot
 * edit one, so a changed discount is a new one. The code is left empty (the
 * provider refuses a second discount with the same code) and dates already
 * past are dropped, so the copy is valid as soon as it has a new code.
 */
export function formFromDiscount(discount: Discount, now: number): AdminDiscountForm {
  const future = (iso: string | null) => (iso && Date.parse(iso) > now ? isoToWallClock(iso) : "");

  return {
    name: discount.name,
    code: "",
    amountType: discount.amountType,
    amount:
      discount.amountType === "percent"
        ? String(discount.amount)
        : (discount.amount / 100).toFixed(2).replace(/\.00$/, ""),
    duration: discount.duration,
    months: String(discount.months ?? 3),
    maxUses: discount.maxUses === null ? "" : String(discount.maxUses),
    startsAt: future(discount.startsAt),
    expiresAt: future(discount.expiresAt),
    plans: discount.plans.map(offerKey),
  };
}
