"use client";

import { Button } from "@heroui/react";

import { LinkButton } from "@/components/ui/link-button";
import { isDowngrade, type Offer } from "@/lib/billing/plan-change";
import type { BillingStanding } from "@/lib/billing/standing";
import { formatDate } from "@/lib/format/date";
import { MARKETING_PLANS, type MarketingPlan, type PlanCadence } from "@/lib/marketing/plans";
import type { PlanId } from "@/lib/repositories/plan-limits";

/**
 * What one plan column's footer offers, as a decision rather than as markup.
 *
 * The one outcome that must never happen is a paying customer being offered
 * `/upgrade`: that opens a fresh checkout, which for somebody who already pays is
 * a *second* subscription and a second charge. So a `switchable` subscription
 * only ever gets `change`, `switch-cadence` or `keep`, all of which move the
 * subscription they have in place.
 */
export type PlanActionKind =
  /** The plan and cadence this account is on. */
  | "on-it"
  /** The plan this account is on, at the other cadence. */
  | "switch-cadence"
  /** Another paid plan, moved in place. */
  | "change"
  /** The plan paid for, while a downgrade waits for the renewal: undoes it. */
  | "keep"
  /** The plan and cadence a pending downgrade moves to at the renewal. */
  | "booked"
  /** Another paid plan, bought fresh — for an account with nothing to move. */
  | "checkout"
  /** Free, while paying: that is Cancel plan, in the Plan section above. */
  | "cancel-above"
  /** A past-due or paused subscription: the card first, then a switch. */
  | "held"
  /** Free, while a cancelled subscription runs out: it arrives by itself. */
  | "moves-to-free"
  /** Any other paid plan while cancelled: resuming comes before switching. */
  | "resume-first";

/** A downgrade waiting for the renewal: what it moves to, and when. */
export type PendingChange = { next: Offer; until: string };

export function planActionFor({
  plan,
  cadence,
  current,
  currentCadence,
  standing,
  pending,
  endsOn,
}: {
  plan: MarketingPlan;
  cadence: PlanCadence;
  /** The plan paid for this period — the kept one while a downgrade waits. */
  current: PlanId;
  currentCadence: PlanCadence | null;
  standing: BillingStanding;
  pending: PendingChange | null;
  /**
   * The last day of a cancelled subscription, or null when it is not cancelled.
   * Our row cannot say this (a cancelled subscription is `active` in it), so the
   * Billing page reads it from the provider and passes it in.
   */
  endsOn: string | null;
}): PlanActionKind | null {
  const isCurrent = plan.id === current;

  /*
   * Cancelled comes first. Every switch would move a subscription that is about
   * to end, so none is offered: the plan paid for says so, Free says when it
   * arrives, and every other column points at Resume.
   */
  if (endsOn && standing !== "none") {
    if (plan.id === "free") return "moves-to-free";

    return isCurrent && cadence === currentCadence ? "on-it" : "resume-first";
  }

  if (plan.id === "free") {
    if (isCurrent) return "on-it";

    return standing === "switchable" ? "cancel-above" : null;
  }

  if (pending && plan.id === pending.next.plan && cadence === pending.next.cadence) {
    return "booked";
  }

  if (isCurrent) {
    if (cadence === currentCadence) return pending ? "keep" : "on-it";

    /*
     * Only when the cadence is *known*. A subscription recorded before the
     * column existed has none, and offering "Switch to yearly" to somebody who
     * may already pay yearly is a button that could move them nowhere, or
     * somewhere they did not mean. The account page backfills it from the
     * provider, so this is the rare case of that read failing.
     */
    return standing === "switchable" && currentCadence !== null
      ? "switch-cadence"
      : "on-it";
  }

  if (standing === "switchable") return "change";
  if (standing === "held") return "held";

  return "checkout";
}

/**
 * What pressing this column's button would do, said before the press: the
 * button moves money and there is no confirmation step behind it.
 *
 * Drawn at the top of the column, under the price, rather than under the button
 * — a line there made one footer taller than the others and pushed the columns
 * out of line. Null for a column with nothing to press.
 */
export function planNoteFor({
  kind,
  plan,
  cadence,
  current,
  currentCadence,
  pending,
  renewsOn,
}: {
  kind: PlanActionKind | null;
  plan: MarketingPlan;
  cadence: PlanCadence;
  current: PlanId;
  currentCadence: PlanCadence | null;
  pending: PendingChange | null;
  renewsOn: string | null;
}): string | null {
  if (kind === "keep") {
    return pending ? `No charge. Nothing changes on ${formatDate(pending.until)}.` : null;
  }

  if (kind !== "change" && kind !== "switch-cadence") return null;

  const from = { plan: current, cadence: currentCadence };

  return isDowngrade(from, { plan: plan.id, cadence })
    ? whenDowngradeStarts(from, plan, pending?.until ?? renewsOn)
    : "Starts now. The difference is added to your next bill.";
}

export function PlanAction({
  kind,
  plan,
  cadence,
  current,
  currentCadence,
  pending,
  endsOn,
  isPending,
  isBusy,
  onChange,
}: {
  kind: PlanActionKind | null;
  plan: MarketingPlan;
  cadence: PlanCadence;
  current: PlanId;
  currentCadence: PlanCadence | null;
  pending: PendingChange | null;
  /** The last day of a cancelled subscription — see `planActionFor`. */
  endsOn: string | null;
  /** This column's own switch is in flight. */
  isPending: boolean;
  /** Any column's switch is in flight — one change at a time. */
  isBusy: boolean;
  onChange: (label: string) => void;
}) {
  switch (kind) {
    case "on-it":
      /*
       * A disabled button rather than a sentence, at the owner's call: every
       * column ends in a button of the same height, so the three footers line
       * up and the one you are on reads as the button you no longer need.
       */
      return (
        <Button fullWidth isDisabled>
          Current plan
        </Button>
      );

    case "booked":
      return (
        <Button fullWidth isDisabled variant="secondary">
          Starts {pending ? formatDate(pending.until) : "at your renewal"}
        </Button>
      );

    case "keep":
    case "switch-cadence":
    case "change": {
      const label = labelFor(kind, plan, cadence, current, pending);
      const down =
        kind !== "keep" &&
        isDowngrade({ plan: current, cadence: currentCadence }, { plan: plan.id, cadence });

      // What the press does to the money is said by `planNoteFor`, at the top
      // of the column rather than under the button.
      return (
        <Button
          fullWidth
          variant={down ? "secondary" : undefined}
          isPending={isPending}
          isDisabled={isBusy && !isPending}
          onPress={() => onChange(label)}
        >
          {label}
        </Button>
      );
    }

    case "checkout":
      /*
       * The same door `/pricing`'s cards use: it reads the session, opens the
       * merchant of record's checkout and brings the buyer back through
       * `/checkout/done`. Only reached by an account with no subscription to
       * move — see `planActionFor`.
       */
      return (
        <LinkButton href={`/upgrade?plan=${plan.id}&cadence=${cadence}`} fullWidth>
          Upgrade to {plan.name}
        </LinkButton>
      );

    case "cancel-above":
      return (
        <p className="text-sm text-muted">
          To move to Free, use Cancel plan above. You keep what you&apos;ve paid for
          until then.
        </p>
      );

    case "held":
      return (
        <p className="text-sm text-muted">
          Update your card under Payment first, then change plan here.
        </p>
      );

    case "moves-to-free":
      // A disabled button, like "Current plan", so this footer is the same
      // height as its neighbours and the columns stay in line.
      return (
        <Button fullWidth isDisabled variant="secondary">
          Starts {endsOn ? formatDate(endsOn) : "when your plan ends"}
        </Button>
      );

    case "resume-first":
      return (
        <p className="text-sm text-muted">Resume your plan above to change it.</p>
      );

    default:
      return null;
  }
}

function labelFor(
  kind: "keep" | "switch-cadence" | "change",
  plan: MarketingPlan,
  cadence: PlanCadence,
  current: PlanId,
  pending: PendingChange | null,
): string {
  if (kind === "keep") {
    // Only the cadence is pending when the plan is not changing.
    return pending?.next.plan === plan.id ? `Keep ${cadence} billing` : `Keep ${plan.name}`;
  }

  if (kind === "switch-cadence") return `Switch to ${cadence} billing`;

  return `${isDowngrade({ plan: current, cadence: null }, { plan: plan.id, cadence: null }) ? "Downgrade" : "Upgrade"} to ${plan.name}`;
}

/** When a downgrade pressed now would take effect, said in what the customer keeps. */
function whenDowngradeStarts(from: Offer, to: MarketingPlan, until: string | null): string {
  if (!until) return "Starts at your next renewal.";

  return from.plan === to.id
    ? `Your ${from.cadence ?? "current"} billing runs until ${formatDate(until)}.`
    : `You keep ${nameOf(from.plan)} until ${formatDate(until)}.`;
}

export function nameOf(plan: PlanId): string {
  return MARKETING_PLANS.find((entry) => entry.id === plan)?.name ?? plan;
}
