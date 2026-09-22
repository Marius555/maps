import { Card, Chip } from "@heroui/react";
import type { ReactNode } from "react";

import { PlanRowList } from "@/components/ui/plan-row-list";
import { planRows, type PlanRow } from "@/lib/marketing/plan-rows";
import type { MarketingPlan, PlanCadence } from "@/lib/marketing/plans";

/**
 * One plan, as a customer who is already on one of the three sees it.
 *
 * **A sibling of `components/marketing/plans/plan-card.tsx`, not a copy of it.**
 * The rows are literally the same list — `lib/marketing/plan-rows.ts`, drawn by
 * `PlanRowList` — so the two pages can never word one limit differently. What
 * differs is everything around them, and it differs because the reader does: a
 * stranger on `/pricing` is choosing, and the person here has already chosen and
 * wants to know what moves if they change.
 *
 * So the pitch, the highlight and the "Most people" tag are gone, the current
 * plan is marked instead of the recommended one, and the rows that would actually
 * change are the only ones tinted.
 *
 * **The footer is a slot.** What a column offers depends on the subscription
 * behind the account — a fresh checkout, a switch in place, or a pointer at the
 * portal — and that decision is `planActionFor` in `plan-action.tsx`, made once
 * per column by `PlanCompare`. This file only draws the plan.
 *
 * **The note is at the top, and the columns share their row heights.** What a
 * press would do to the money (`planNoteFor`) sits under the price rather than
 * under the button, where it made one footer taller than the rest. And from
 * `md` up each card is a subgrid of `PlanCompare`'s grid, so the header, the
 * rows and the footer are each as tall as the tallest of the three — a note in
 * one column moves every column's rows down together instead of knocking them
 * out of line.
 */
export function PlanColumn({
  plan,
  current,
  cadence,
  /** The plan being compared against, so the rows that move can be marked. */
  against,
  note,
  action,
}: {
  plan: MarketingPlan;
  current: boolean;
  cadence: PlanCadence;
  against: MarketingPlan;
  /** What pressing this column's button would do, or null. */
  note: string | null;
  action: ReactNode;
}) {
  /*
   * Free has no year to buy, so it prints "€0" under either setting rather than
   * disappearing from the row or showing a blank price when the toggle moves.
   */
  const yearly = cadence === "yearly" && plan.amountYearly !== undefined;
  const price = yearly ? plan.priceYearly : plan.price;
  const per = yearly ? "a year" : plan.cadence;

  const rows = planRows(plan);
  const baseline = new Map(planRows(against).map((row) => [row.id, row]));

  return (
    <Card
      className={`h-full md:row-span-3 md:grid md:grid-rows-subgrid ${current ? "ring-2 ring-accent" : ""}`}
    >
      <Card.Header>
        <div className="flex items-baseline justify-between gap-3">
          <Card.Title>{plan.name}</Card.Title>
          {current ? (
            <Chip size="sm" variant="soft" color="accent">
              <Chip.Label>Your plan</Chip.Label>
            </Chip>
          ) : null}
        </div>

        <p className="mk-display mt-2 text-3xl text-foreground">
          {price}
          {per ? (
            <span className="ml-2 font-sans text-sm font-normal tracking-normal text-muted">
              {per}
            </span>
          ) : null}
        </p>

        {/* The saving said as what it is rather than as a percentage, and held in
            the layout either way so the toggle does not move the columns. */}
        <p
          className={`text-xs ${yearly ? "text-accent" : "invisible"}`}
          aria-hidden={!yearly}
        >
          Two months free
        </p>

        {note ? <p className="mt-2 text-xs text-pretty text-muted">{note}</p> : null}
      </Card.Header>

      <Card.Content>
        <PlanRowList
          rows={rows}
          emphasise={(row) => !current && improves(row, baseline.get(row.id))}
        />
      </Card.Content>

      {action ? <Card.Footer className="mt-auto">{action}</Card.Footer> : null}
    </Card>
  );
}

/**
 * Whether this row is better than the same row on the current plan.
 *
 * Matched on `row.id` rather than on the label, so renaming a label cannot
 * silently stop a row being compared. A row that is equal is not marked: the
 * point of the tint is "this is what you would gain", and every plan having
 * unlimited views is not a gain.
 */
function improves(row: PlanRow, baseline: PlanRow | undefined): boolean {
  if (!baseline || baseline.kind !== row.kind) return false;

  if (row.kind === "quantity") {
    return baseline.kind === "quantity" && row.value > baseline.value;
  }

  return baseline.kind === "feature" && row.on && !baseline.on;
}
