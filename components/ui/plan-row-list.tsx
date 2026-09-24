import { Check, Minus } from "lucide-react";

import { formatCount } from "@/lib/format/number";
import type { PlanRow } from "@/lib/marketing/plan-rows";

/**
 * A plan's limits as a definition list — the same rows on `/pricing` and on
 * Settings → Billing.
 *
 * The rows themselves come from `lib/marketing/plan-rows.ts`; this is only how
 * they are drawn, kept here because both callers draw them identically and a
 * second copy would drift in spacing before it drifted in wording.
 *
 * `emphasise` marks the rows that change if you take the plan being shown. It is
 * how the account page says "this is what moves" without a second column of
 * arrows, and it is a tint on a value that is already there rather than an extra
 * mark — a row that reads correctly with the emphasis ignored.
 */
export function PlanRowList({
  rows,
  emphasise,
}: {
  rows: PlanRow[];
  emphasise?: (row: PlanRow) => boolean;
}) {
  return (
    <dl className="space-y-2.5 border-t border-border pt-5 text-sm">
      {rows.map((row) => (
        <Row key={row.id} row={row} emphasised={emphasise?.(row) ?? false} />
      ))}
    </dl>
  );
}

function Row({ row, emphasised }: { row: PlanRow; emphasised: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{row.label}</dt>

      {row.kind === "quantity" ? (
        <dd
          className={`font-mono text-[0.8125rem] ${
            emphasised ? "font-semibold text-accent" : "text-foreground"
          }`}
        >
          {formatCount(row.value)}
        </dd>
      ) : (
        <Feature row={row} emphasised={emphasised} />
      )}
    </div>
  );
}

/**
 * A feature, with the icon *and* the word — never the tick alone.
 *
 * A row that says only "Routes" beside a grey tick asks the reader to work out
 * which state they are looking at from a colour, which is exactly what the
 * quality floor rules out.
 */
function Feature({
  row,
  emphasised,
}: {
  row: Extract<PlanRow, { kind: "feature" }>;
  emphasised: boolean;
}) {
  return (
    <dd
      className={`flex items-center gap-1.5 text-[0.8125rem] ${
        emphasised
          ? "font-semibold text-accent"
          : row.on
            ? "text-foreground"
            : "text-muted"
      }`}
    >
      {row.on ? (
        <Check aria-hidden="true" className="size-3.5 text-accent" />
      ) : (
        <Minus aria-hidden="true" className="size-3.5" />
      )}
      {row.note ?? (row.on ? "Included" : "Not on this plan")}
    </dd>
  );
}
