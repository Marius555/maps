import { discountAppliesTo } from "@/lib/billing/discounts";
import type { PublicDiscount } from "@/lib/billing/types";

import {
  MARKETING_PLANS,
  RECOMMENDED_PLAN,
  type MarketingPlan,
  type PlanCadence,
} from "./plans";

/**
 * Which card /pricing marks as recommended, given the discount it applied.
 *
 * The mark follows the discount: a code covering one paid plan at this cadence
 * moves it there, and a code covering several moves it to the dearest of them.
 * One covering every paid plan singles none out, so the default stands — as it
 * does with no discount at all. Free is never discounted and never counts.
 */
export function recommendedPlan(
  discount: PublicDiscount | null,
  cadence: PlanCadence,
): MarketingPlan["id"] {
  if (!discount) return RECOMMENDED_PLAN;

  const paid = MARKETING_PLANS.filter(
    (plan): plan is MarketingPlan & { id: "starter" | "pro" } => plan.id !== "free",
  );
  const covered = paid.filter((plan) => discountAppliesTo(discount, { plan: plan.id, cadence }));

  if (covered.length === 0 || covered.length === paid.length) return RECOMMENDED_PLAN;

  return covered.reduce((dearest, plan) => (plan.amount > dearest.amount ? plan : dearest)).id;
}

/**
 * Which cadence /pricing should show once a code has been entered.
 *
 * The current one, unless the code covers nothing at it and something at the
 * other — a yearly-only code entered on Monthly would otherwise apply to no card
 * on screen, and read as refused. The caller does this once per visit, so a
 * visitor who toggles back afterwards is not pulled over again.
 */
export function cadenceForDiscount(discount: PublicDiscount, cadence: PlanCadence): PlanCadence {
  const covers = (at: PlanCadence) =>
    discountAppliesTo(discount, { plan: "starter", cadence: at }) ||
    discountAppliesTo(discount, { plan: "pro", cadence: at });
  const other: PlanCadence = cadence === "monthly" ? "yearly" : "monthly";

  return !covers(cadence) && covers(other) ? other : cadence;
}
