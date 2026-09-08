import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { formatCount } from "@/lib/format/number";
import type { Delta } from "@/lib/analytics/view";

/**
 * One headline figure, with how it moved.
 *
 * **Tiles here, where the rest of this app uses a table** — and the exception is
 * worth stating because the deleted content stats argued the opposite at length.
 * That argument was about *comparison*: which tag nothing is wearing, which
 * column of the card is empty, questions answered by running the eye down a
 * column. These five are not a set to compare. They are five different
 * quantities in five different units, and putting "Map loads: 1,284" next to
 * "Searches: 31" in one column invites a comparison that means nothing.
 *
 * Every table further down the page is still a table, for the original reason.
 *
 * The delta's colour is direction only, and only where direction has a meaning:
 * more visits is good, so up is `--success`. It is never colour alone — the
 * arrow and the signed number both say it, which is what keeps it readable in
 * forced-colors mode and for anyone who cannot separate the two hues.
 */
export function StatTile({
  label,
  delta,
  hint,
}: {
  label: string;
  delta: Delta;
  /** What the number counts, when the label alone would not say. */
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="text-xs text-muted">{label}</p>

      <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {formatCount(delta.value)}
      </p>

      <ChangeLine delta={delta} hint={hint} />
    </div>
  );
}

function ChangeLine({ delta, hint }: { delta: Delta; hint?: string }) {
  /*
   * No previous period to compare against — a map in its first month, or one
   * whose earlier days have aged past the rollups. "Up ∞%" is not a fact about
   * the map, so the tile says the true thing instead.
   */
  if (delta.change === null) {
    return (
      <p className="mt-1 text-xs text-muted">{hint ?? "No earlier period yet"}</p>
    );
  }

  if (delta.change === 0) {
    return <p className="mt-1 text-xs text-muted">No change</p>;
  }

  const isUp = delta.change > 0;
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight;
  const percent = Math.abs(Math.round(delta.change * 100));

  /*
   * Two lines, and the break is deliberate rather than left to wrapping.
   *
   * Five tiles across `lg` leaves each about 180px, which is not enough for
   * "↗ +203% vs previous period" — so it wrapped after "vs previous" and left
   * "period" alone on a second line. Breaking it on purpose puts the figure on
   * one line and what it is measured against on the next.
   */
  return (
    <div className="mt-1 text-xs">
      <p className="flex items-center gap-1">
        <Arrow
          aria-hidden="true"
          className="size-3.5 shrink-0"
          style={{ color: isUp ? "var(--success)" : "var(--muted)" }}
        />
        <span
          className="tabular-nums"
          style={{ color: isUp ? "var(--success)" : "var(--muted)" }}
        >
          {isUp ? "+" : "−"}
          {percent}%
        </span>
      </p>
      {/* The comparison is named rather than assumed. "+12%" against nothing
          stated is a number people invent a meaning for. */}
      <p className="text-muted">vs previous period</p>
    </div>
  );
}
