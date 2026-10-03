import type { Discount, DiscountStatus, PlanOffer, PublicDiscount } from "./types";

/**
 * The pure half of discounts: what a code's state is, how it is written down
 * and the link that opens a checkout with it. No `server-only`, no env — the
 * console's client components import it, and the tests run it bare.
 */

/** Everything that can be bought, in the order the console lists it. */
export const PLAN_OFFERS: readonly PlanOffer[] = [
  { plan: "starter", cadence: "monthly" },
  { plan: "starter", cadence: "yearly" },
  { plan: "pro", cadence: "monthly" },
  { plan: "pro", cadence: "yearly" },
];

export type PlanOfferKey = "starter-monthly" | "starter-yearly" | "pro-monthly" | "pro-yearly";

export const PLAN_OFFER_KEYS: readonly PlanOfferKey[] = PLAN_OFFERS.map(offerKey);

export function offerKey(offer: PlanOffer): PlanOfferKey {
  return `${offer.plan}-${offer.cadence}`;
}

export function offerFromKey(key: PlanOfferKey): PlanOffer {
  const [plan, cadence] = key.split("-") as [PlanOffer["plan"], PlanOffer["cadence"]];

  return { plan, cadence };
}

export function offerLabel({ plan, cadence }: PlanOffer): string {
  return `${plan === "pro" ? "Pro" : "Starter"} ${cadence}`;
}

/**
 * Where a code stands at `now`. Expiry outranks a start date (a window that has
 * closed is closed, whether or not it ever opened), and a code past its cap is
 * used up even while its window is open.
 */
export function discountStatus(
  discount: Pick<Discount, "startsAt" | "expiresAt" | "maxUses" | "uses">,
  now: number,
): DiscountStatus {
  if (discount.expiresAt && Date.parse(discount.expiresAt) <= now) return "expired";
  if (discount.maxUses !== null && discount.uses !== null && discount.uses >= discount.maxUses) {
    return "used_up";
  }
  if (discount.startsAt && Date.parse(discount.startsAt) > now) return "scheduled";

  return "active";
}

/** "20%" or "€5.00". The store sells in euros, as `/pricing` does. */
export function formatDiscountAmount(discount: Pick<Discount, "amountType" | "amount">): string {
  return discount.amountType === "percent"
    ? `${String(discount.amount)}%`
    : `€${(discount.amount / 100).toFixed(2)}`;
}

/** "First payment", "First 3 months", "Every payment". */
export function formatDiscountDuration(discount: Pick<Discount, "duration" | "months">): string {
  if (discount.duration === "forever") return "Every payment";
  if (discount.duration === "repeating") {
    const months = discount.months ?? 1;
    return months === 1 ? "First month" : `First ${String(months)} months`;
  }

  return "First payment";
}

/**
 * A link to the pricing page with `code` applied: the cards show what it
 * takes off, and the visitor picks the plan there.
 *
 * **A code, never an amount**: the page asks the server what the code is
 * worth, and the provider decides again at the checkout, so a hand-edited link
 * can name a code but not a price.
 */
export function discountShareLink(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/+$/, "")}/pricing?${new URLSearchParams({ code }).toString()}`;
}

/** Whether a discount covers this plan at this cadence. No plans listed is every plan. */
export function discountAppliesTo(discount: Pick<PublicDiscount, "plans">, offer: PlanOffer): boolean {
  return (
    discount.plans.length === 0 ||
    discount.plans.some((entry) => entry.plan === offer.plan && entry.cadence === offer.cadence)
  );
}

/** A price in euros with the discount taken off, never below zero, to the cent. */
export function discountedEuros(
  euros: number,
  discount: Pick<PublicDiscount, "amountType" | "amount">,
): number {
  const off =
    discount.amountType === "percent" ? (euros * discount.amount) / 100 : discount.amount / 100;

  return Math.max(0, Math.round((euros - off) * 100) / 100);
}

/** "€19", "€15.20" — cents only when there are any, as `/pricing` writes prices. */
export function formatEuros(euros: number): string {
  return Number.isInteger(euros) ? `€${String(euros)}` : `€${euros.toFixed(2)}`;
}

/**
 * What the discount does to this cadence's payments, in a few words:
 * "20% off your first month", "€5 off the first 3 months", "20% off every payment".
 *
 * A yearly plan is one payment a year, so anything short of "every payment"
 * covers its first year and nothing after — a 3-month discount on a yearly plan
 * is the first year's payment, which is how the provider applies it.
 */
export function discountNote(
  discount: Pick<PublicDiscount, "amountType" | "amount" | "duration" | "months">,
  cadence: PlanOffer["cadence"],
): string {
  const amount = formatDiscountAmount(discount);

  if (discount.duration === "forever") return `${amount} off every payment`;
  if (cadence === "yearly") return `${amount} off your first year`;
  if (discount.duration === "repeating" && (discount.months ?? 1) > 1) {
    return `${amount} off the first ${String(discount.months)} months`;
  }

  return `${amount} off your first month`;
}

/** A fresh code: eight characters with no 0/O or 1/I to misread. */
export function randomDiscountCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array.from({ length: 8 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}
