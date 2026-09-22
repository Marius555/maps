import type { PlanId } from "@/lib/repositories/plan-limits";
import type { BillingCadence, KeptPlan, PaidPlanId } from "./types";

/**
 * How a plan change is carried out, decided once and without the provider.
 *
 * **The rule the customer sees: an upgrade starts now, a downgrade starts at the
 * renewal.** Somebody who paid for a month of Pro keeps Pro for that month. The
 * provider cannot book a change for later — its own guide: "the plan change takes
 * effect immediately, regardless of the proration option chosen" — so the two
 * halves are split between it and us:
 *
 * - **The provider is moved at once, without proration.** Its variant becomes
 *   the lower plan today, nothing is credited or charged, and the next renewal
 *   is billed at the new price. Billing is right by construction, with no job
 *   that has to fire on the right night.
 * - **We keep the plan that was paid for** (`KeptPlan`, three columns on the
 *   subscription row) until that renewal, and `getUserPlan` grants it. If those
 *   columns were ever lost, the customer would drop to what they are now billed
 *   for a few weeks early — visible, and the cheap direction to fail in.
 *
 * An upgrade takes the provider's default instead: the new plan now, and the
 * difference on the next bill.
 *
 * Pure, and outside the repositories, so the route and the account page read one
 * decision and it can be tested without a database or a network.
 */

/** Cheapest first, the order every page already lists the plans in. */
const PLAN_ORDER: readonly PlanId[] = ["free", "starter", "pro"];

/** A plan at a cadence. Cadence is null only when it was never known. */
export type Offer = { plan: PlanId; cadence: BillingCadence | null };

/** The parts of a subscription row this reads. */
type Row = Offer & { kept: KeptPlan | null };

export type PlanChangeStep = {
  plan: PaidPlanId;
  cadence: BillingCadence;
  prorate: boolean;
};

export type PlanChange =
  /** The provider already bills this plan and cadence. */
  | { kind: "unchanged" }
  | {
      kind: "change";
      /** Sent to the provider in order. More than one only to undo a pending downgrade first. */
      steps: PlanChangeStep[];
      /**
       * What the row keeps once the steps are done. `until: null` means the
       * renewal date the provider answers the change with — the one date that is
       * certainly current, which the stored row may not be.
       */
      keep: (Omit<KeptPlan, "until"> & { until: string | null }) | null;
    };

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

/** Whether moving `from` → `to` is a step down. Plan decides first; cadence only within one plan. */
export function isDowngrade(from: Offer, to: Offer): boolean {
  const delta = rank(to.plan) - rank(from.plan);

  if (delta !== 0) return delta < 0;

  return from.cadence === "yearly" && to.cadence === "monthly";
}

/**
 * The downgrade waiting for the renewal, or null when none is.
 *
 * A kept plan whose date has passed is not an error and is not swept: the
 * renewal happened, the provider bills the new plan, and the stale columns mean
 * nothing — the same way a dangling tag id means nothing.
 */
export function pendingKept(row: Row | null, now: number = Date.now()): KeptPlan | null {
  if (!row?.kept) return null;

  const { kept } = row;

  if (!isFuture(kept.until, now)) return null;
  if (kept.plan === row.plan && kept.cadence === row.cadence) return null;

  return kept;
}

/** What this period was paid for: the kept plan while a downgrade waits, else what is billed. */
export function paidOffer(row: Row, now: number = Date.now()): Offer {
  const kept = pendingKept(row, now);

  return kept ? { plan: kept.plan, cadence: kept.cadence } : { plan: row.plan, cadence: row.cadence };
}

/**
 * The plan to grant, with a kept one honoured until its date.
 *
 * Only ever *raises* what the subscription already grants, and never from
 * `free`: a subscription that has ended, lapsed or been refused grants nothing,
 * and a downgrade booked on it must not bring a plan back.
 */
export function withKeptPlan(
  granted: PlanId,
  kept: { plan: PlanId; until: string } | null,
  now: number = Date.now(),
): PlanId {
  if (granted === "free" || !kept || !isFuture(kept.until, now)) return granted;

  return rank(kept.plan) > rank(granted) ? kept.plan : granted;
}

export function planChange(
  row: Row,
  target: { plan: PaidPlanId; cadence: BillingCadence },
  now: number = Date.now(),
): PlanChange {
  if (row.plan === target.plan && row.cadence === target.cadence) {
    return { kind: "unchanged" };
  }

  const kept = pendingKept(row, now);
  const paid = paidOffer(row, now);

  // Back to what this period was paid for: nothing is owed either way, and
  // nothing is pending any more.
  if (kept && kept.plan === target.plan && kept.cadence === target.cadence) {
    return { kind: "change", steps: [{ ...target, prorate: false }], keep: null };
  }

  if (isDowngrade(paid, target)) {
    return {
      kind: "change",
      steps: [{ ...target, prorate: false }],
      // A second downgrade while one waits keeps the same paid plan and date.
      keep:
        kept ??
        (paid.plan === "free" ? null : { plan: paid.plan, cadence: paid.cadence, until: null }),
    };
  }

  /*
   * An upgrade. With a downgrade pending, the provider is billing the *lower*
   * plan, and prorating up from there would charge again for the part of this
   * period already paid at the higher one — so it is put back first, without
   * proration, and the upgrade is prorated from what was actually paid.
   */
  const restore: PlanChangeStep[] =
    kept?.cadence ? [{ plan: kept.plan, cadence: kept.cadence, prorate: false }] : [];

  return { kind: "change", steps: [...restore, { ...target, prorate: true }], keep: null };
}
