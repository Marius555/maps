import { MARKETING_PLANS } from "@/lib/marketing/plans";

/**
 * Who is paying and what that is worth a month. Pure; `revenue.test.ts`.
 *
 * "Paying" is read the way `getUserPlan` reads entitlement — status `active`
 * and a period that has not ended — so the console never counts somebody the
 * product itself treats as free. A cancellation stays `active` until its date,
 * which is right: it is paid for until then (docs/notes/billing.md).
 *
 * Prices come from `MARKETING_PLANS`, the table the pricing page draws, so the
 * console cannot quote a number the customer was never charged. An estimate:
 * it ignores tax, coupons and currency, which only the provider knows.
 */

export type SubscriptionLike = {
  plan: string;
  status: string;
  cadence: string | null;
  currentPeriodEnd: string | null;
};

export function isPaying(sub: SubscriptionLike, now: Date = new Date()): boolean {
  if (sub.status !== "active") return false;
  if (sub.plan !== "starter" && sub.plan !== "pro") return false;
  if (!sub.currentPeriodEnd) return true;

  const end = Date.parse(sub.currentPeriodEnd);
  return !Number.isFinite(end) || end > now.getTime();
}

/** Monthly value in euros; yearly plans spread over twelve months. */
export function monthlyValue(sub: SubscriptionLike): number {
  const plan = MARKETING_PLANS.find((entry) => entry.id === sub.plan);
  if (!plan) return 0;

  if (sub.cadence === "yearly" && plan.amountYearly !== undefined) {
    return plan.amountYearly / 12;
  }

  return plan.amount;
}

export function estimateMrr(subs: SubscriptionLike[], now: Date = new Date()): number {
  return subs
    .filter((sub) => isPaying(sub, now))
    .reduce((total, sub) => total + monthlyValue(sub), 0);
}

/** `€1,234` — whole euros, formatted by hand so server and client agree. */
export function formatEuros(value: number): string {
  const whole = Math.round(value);
  return `€${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
