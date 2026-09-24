import { Alert } from "@heroui/react";

import type { SubscriptionStatus } from "@/lib/billing/types";
import { formatDate } from "@/lib/format/date";
import { MARKETING_PLANS, type PlanCadence } from "@/lib/marketing/plans";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { CancelPlanButton } from "./cancel-plan-button";
import { ResumePlanButton } from "./resume-plan-button";

/**
 * Which plan, what it costs, and until when — with the one control that ends or
 * restores it.
 *
 * **"Renews" or "Ends", and this is the page that can finally tell them apart.**
 * Our row stores a cancelled subscription as `active` with its last day in
 * `currentPeriodEnd`, which is right for deciding what it grants and useless
 * for deciding what to say: the old account header printed "Renews" on a
 * subscription that was not going to. `cancelled` here comes from the provider,
 * read on this visit.
 *
 * What each status means to the person on it, in their words rather than the
 * provider's. `canceled` is absent on purpose: `getUserPlan` reads such an
 * account as free, and a line saying "cancelled" would be describing a
 * subscription that is no longer doing anything.
 */
const STATUS_NOTE: Partial<
  Record<SubscriptionStatus, { status: "danger" | "warning"; title: string; body: string }>
> = {
  past_due: {
    status: "danger",
    title: "Your last payment didn't go through",
    body: "Update your card under Payment to keep this plan. Nothing you've built is affected in the meantime.",
  },
  paused: {
    status: "warning",
    title: "This subscription is paused",
    body: "The plan's limits don't apply while it is, and your published maps keep working.",
  },
  trialing: {
    status: "warning",
    title: "You're on a trial",
    body: "It becomes a paid subscription when the trial ends.",
  },
};

export function CurrentPlan({
  plan,
  cadence,
  status,
  cancelled,
  renewsOn,
  endsOn,
  canCancel,
}: {
  /** The plan paid for this period, or free. */
  plan: PlanId;
  cadence: PlanCadence | null;
  /** Null for an account that has never subscribed. */
  status: SubscriptionStatus | null;
  cancelled: boolean;
  renewsOn: string | null;
  endsOn: string | null;
  /** A running subscription the provider can be asked to stop. */
  canCancel: boolean;
}) {
  const entry = MARKETING_PLANS.find((candidate) => candidate.id === plan) ?? MARKETING_PLANS[0];
  const note = status ? STATUS_NOTE[status] : undefined;
  const isPaid = entry.id !== "free";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">{entry.name} plan</p>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {isPaid ? priceLine(entry, cadence) : entry.pitch}
            {isPaid ? <DateLine cancelled={cancelled} renewsOn={renewsOn} endsOn={endsOn} /> : null}
          </p>
        </div>

        {cancelled && canCancel ? (
          <ResumePlanButton planName={entry.name} />
        ) : canCancel ? (
          <CancelPlanButton planName={entry.name} endsOn={renewsOn} />
        ) : null}
      </div>

      {note ? (
        <Alert status={note.status} className="mt-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{note.title}</Alert.Title>
            <Alert.Description>{note.body}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </div>
  );
}

function priceLine(
  entry: (typeof MARKETING_PLANS)[number],
  cadence: PlanCadence | null,
): string {
  if (cadence === "yearly" && entry.priceYearly) return `${entry.priceYearly} a year`;
  if (cadence === "monthly") return `${entry.price} ${entry.cadence ?? "a month"}`;

  // Unknown, not monthly: see `SubscriptionState.cadence`.
  return "Paid plan";
}

function DateLine({
  cancelled,
  renewsOn,
  endsOn,
}: {
  cancelled: boolean;
  renewsOn: string | null;
  endsOn: string | null;
}) {
  const date = cancelled ? endsOn : renewsOn;
  if (!date) return null;

  return (
    <>
      {" · "}
      {cancelled ? "Ends " : "Renews "}
      <time dateTime={date}>{formatDate(date)}</time>
      {cancelled ? ". You won't be charged again." : null}
    </>
  );
}
