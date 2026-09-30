import { Label, Meter } from "@heroui/react";

import { formatCount } from "@/lib/format/number";

/**
 * Today's pooled lookups against the day's budget, as a HeroUI `Meter` with a
 * tick where background work stands aside. The state is told in words as well
 * as colour and length: under the reserve, background paused, or the day spent.
 *
 * It used to be a hand-drawn `role="meter"` div that looked like HeroUI's and
 * was not — so it matched nothing else in the app when the theme moved.
 */
export function BudgetMeter({
  used,
  budget,
  reserve,
  label = "Lookups used today",
}: {
  used: number;
  budget: number;
  /** Where background work stops, in lookups. */
  reserve: number;
  label?: string;
}) {
  const color = used >= budget ? "danger" : used >= reserve ? "warning" : "success";
  const state =
    used >= budget
      ? "Budget spent — lookups are refused until midnight UTC."
      : used >= reserve
        ? "Past the reserve — background work (syncs, sweeps) is paused."
        : "Under the reserve — everything runs.";

  return (
    <div className="space-y-1.5">
      <Meter
        value={Math.min(used, budget)}
        maxValue={Math.max(1, budget)}
        color={color}
        valueLabel={`${formatCount(used)} of ${formatCount(budget)}`}
      >
        <Label className="text-xs font-normal text-muted">{label}</Label>
        <Meter.Output className="text-xs font-normal text-muted" />
        <Meter.Track>
          <Meter.Fill />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 bg-foreground/60"
            style={{ left: `${String((reserve / Math.max(1, budget)) * 100)}%` }}
          />
        </Meter.Track>
      </Meter>
      <p className="text-xs text-muted">{state}</p>
    </div>
  );
}
