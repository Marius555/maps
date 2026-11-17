import type { PlanId } from "@/lib/repositories/plan-limits";
import type { BillingCadence, PaidPlanId } from "./types";

/**
 * How a plan change is carried out, decided once and without the provider.
 *
 * **The rule the customer sees: an upgrade starts now, a downgrade starts at the
 * renewal.** Somebody who paid for a month of Pro keeps Pro for that month.
 *
 * Stripe can book a change for the end of a period itself (a subscription
 * schedule), so the provider keeps billing — and our row keeps reporting — the
 * plan paid for until the renewal, and the booked change is read live from it.
 * That replaced the `kept*` columns, which existed only because Lemon Squeezy
 * applied every change at once. It is also forced: Stripe restarts the billing
 * period and invoices on the spot when the interval changes, so a yearly →
 * monthly switch made "now, unprorated" would have charged the customer today.
 *
 * Pure, and outside the repositories, so the route and the account page read one
 * decision and it can be tested without a database or a network.
 */

/** Cheapest first, the order every page already lists the plans in. */
const PLAN_ORDER: readonly PlanId[] = ["free", "starter", "pro"];

/** A plan at a cadence. Cadence is null only when it was never known. */
export type Offer = { plan: PlanId; cadence: BillingCadence | null };

type Target = { plan: PaidPlanId; cadence: BillingCadence };

export type PlanChange =
  /** Nothing to do: already billed, or already booked for the renewal. */
  | { kind: "unchanged"; booked: boolean }
  /** Drop the downgrade booked for the renewal; the plan paid for renews. */
  | { kind: "keep" }
  /** An upgrade: starts now, prorated. */
  | { kind: "now"; target: Target }
  /** A downgrade: booked for the renewal, nothing charged today. */
  | { kind: "renewal"; target: Target };

function rank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

function isFuture(iso: string, now: number): boolean {
  /*
   * An unreadable date is *not* in the future — the opposite of `hasLapsed`,
   * deliberately. There, a bad date must not lock somebody out of what they
   * pay for. Here, a bad date would keep granting a plan nobody is billed for
   * any more, for ever.
   */
  const at = Date.parse(iso);

  return Number.isFinite(at) && at > now;
}

function same(a: Offer, b: Offer): boolean {
  return a.plan === b.plan && a.cadence === b.cadence;
}

/** Whether moving `from` → `to` is a step down. Plan decides first; cadence only within one plan. */
export function isDowngrade(from: Offer, to: Offer): boolean {
  const delta = rank(to.plan) - rank(from.plan);

  if (delta !== 0) return delta < 0;

  return from.cadence === "yearly" && to.cadence === "monthly";
}

/**
 * The plan to grant, with a kept one honoured until its date.
 *
 * **Retired with the `kept*` columns** (see `KeptPlan`): nothing writes them
 * since Stripe, so `kept` is null on every row written since, and this returns
 * `granted` unchanged. Kept because `getUserPlan` still reads the columns and a
 * row written before the move must not be re-interpreted.
 *
 * Only ever *raises* what the subscription already grants, and never from
 * `free`: a subscription that has ended, lapsed or been refused grants nothing.
 */
export function withKeptPlan(
  granted: PlanId,
  kept: { plan: PlanId; until: string } | null,
  now: number = Date.now(),
): PlanId {
  if (granted === "free" || !kept || !isFuture(kept.until, now)) return granted;

  return rank(kept.plan) > rank(granted) ? kept.plan : granted;
}

/**
 * What one press asks for.
 *
 * `billed` is what the provider bills this period — our row, which now always
 * means the plan paid for. `scheduled` is a downgrade already booked for the
 * renewal, read live, or null.
 */
export function planChange(
  billed: Offer,
  target: Target,
  scheduled: Offer | null,
): PlanChange {
  if (scheduled && same(scheduled, target)) return { kind: "unchanged", booked: true };

  if (same(billed, target)) return scheduled ? { kind: "keep" } : { kind: "unchanged", booked: false };

  /*
   * A second downgrade while one waits replaces it; an upgrade while one waits
   * starts from what is paid for, which is still what is billed — the adapter
   * lets the booked change go first either way.
   */
  return isDowngrade(billed, target) ? { kind: "renewal", target } : { kind: "now", target };
}
