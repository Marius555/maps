import { Alert } from "@heroui/react";

import { formatDate } from "@/lib/format/date";
import { MARKETING_PLANS, type PlanCadence } from "@/lib/marketing/plans";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { nameOf, type PendingChange } from "./plan-action";

/**
 * A downgrade that is booked but has not happened yet, said under the plans.
 *
 * **It exists because the columns alone cannot say it.** After a downgrade the
 * account is still on the plan it paid for — its column keeps "Your plan" — and
 * the provider already bills the lower one. Without this, the one visible
 * trace of the press is a toast that has gone by the next visit, and the first
 * the customer hears of the change is the renewal.
 *
 * The undo is not repeated here. It is "Keep …" in the paid plan's own column,
 * where every other change on this page is made, and this names it.
 */
export function PlanChangeNotice({
  current,
  currentCadence,
  pending,
}: {
  /** The plan paid for this period. */
  current: PlanId;
  currentCadence: PlanCadence | null;
  pending: PendingChange;
}) {
  const { next, until } = pending;
  const on = formatDate(until);
  const cadenceOnly = next.plan === current;

  const keep = cadenceOnly
    ? `Keep ${currentCadence ?? "current"} billing`
    : `Keep ${nameOf(current)}`;

  return (
    <Alert status="accent" className="mt-4">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {cadenceOnly
            ? `Your billing changes to ${next.cadence ?? "a new cadence"} on ${on}`
            : `Your plan changes to ${nameOf(next.plan)} on ${on}`}
        </Alert.Title>
        <Alert.Description>
          {cadenceOnly
            ? `You stay on ${currentCadence ?? "your current"} billing until then.`
            : `${nameOf(current)} stays on until then, because it's already paid for.`}{" "}
          From {on}, {nameOf(next.plan)} is {priceOf(next.plan, next.cadence)}.{" "}
          Press {keep}, above, to cancel the change.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** "€19 a month" or "€190 a year" — what the renewal will actually charge. */
function priceOf(plan: PlanId, cadence: PlanCadence | null): string {
  const entry = MARKETING_PLANS.find((candidate) => candidate.id === plan);
  if (!entry) return "";

  return cadence === "yearly" && entry.priceYearly
    ? `${entry.priceYearly} a year`
    : `${entry.price} ${entry.cadence ?? ""}`.trim();
}
