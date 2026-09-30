import { Card } from "@heroui/react";
import type { ReactNode } from "react";

import { TrendChip } from "@/components/analytics/dashboard/trend-chip";
import type { DataSource } from "@/lib/admin/source";
import type { Delta } from "@/lib/analytics/view";
import { SourceBadge } from "./source-badge";

export type Stat = {
  label: string;
  /** Already formatted. */
  value: string;
  /** Where the value comes from — drawn beside the label. */
  source: DataSource;
  /** Against the period before; drawn beside the value. */
  delta?: Delta;
  /** One line under the value: the context that makes the figure mean something. */
  note?: ReactNode;
  /** Under the note — a `Meter` for a figure that has a ceiling. */
  extra?: ReactNode;
};

/** Column classes by count, so no row ends in an empty cell. */
const COLUMNS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};

/**
 * A row of figures in one card, split by hairlines — the "where things stand"
 * band at the top of a page.
 *
 * **One card, not a card per figure.** The figures share a surface, carry no
 * icon tiles, and each says in its note what it is measured against and in its
 * badge where it comes from.
 *
 * The hairlines are the grid's gap showing through (`gap-px` over
 * `bg-border`), which stays right however the cells wrap.
 */
export function StatStrip({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <section
        aria-label={label}
        className={`grid gap-px bg-border ${COLUMNS[stats.length] ?? "sm:grid-cols-2"}`}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 bg-surface px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm text-muted">{stat.label}</h3>
              <SourceBadge source={stat.source} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-2xl font-semibold tracking-tight text-foreground">{stat.value}</p>
              {stat.delta ? <TrendChip delta={stat.delta} /> : null}
            </div>
            {stat.note ? <p className="mt-1 text-xs text-pretty text-muted">{stat.note}</p> : null}
            {stat.extra ? <div className="mt-3">{stat.extra}</div> : null}
          </div>
        ))}
      </section>
    </Card>
  );
}
