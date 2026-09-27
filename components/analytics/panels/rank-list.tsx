import type { ReactNode } from "react";

import { formatCount } from "@/lib/format/number";

export type RankRow = {
  key: string;
  /** The name, already rendered — a link, a plain label, a muted "deleted". */
  name: ReactNode;
  count: number;
  /** A trailing detail after the count: "38%". */
  detail?: string;
  /** A swatch before the name, when the row is also a slice of a donut beside it. */
  color?: string;
};

/**
 * A short ranked list with a bar under each name — the summary shape the
 * Overview and Audience cards share.
 *
 * Bars against the busiest row rather than the total: this is a ranking, and on
 * a map with three hundred locations a share of the whole draws every bar as an
 * empty track. The bars are `aria-hidden` — they are a second drawing of the
 * count printed beside them, and announcing both reads every row twice.
 */
export function RankList({ rows }: { rows: RankRow[] }) {
  const busiest = rows.reduce((most, row) => Math.max(most, row.count), 0);

  return (
    <ol className="space-y-3.5">
      {rows.map((row) => {
        const share = busiest > 0 ? row.count / busiest : 0;

        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {row.color ? (
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ background: row.color }}
                  />
                ) : null}
                <span className="min-w-0 truncate">{row.name}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium text-foreground">
                  {formatCount(row.count)}
                </span>
                {row.detail ? (
                  <span className="ml-2 text-xs text-muted">{row.detail}</span>
                ) : null}
              </span>
            </div>

            <span
              aria-hidden="true"
              className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-default"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${share > 0 ? Math.max(share * 100, 1.5) : 0}%`,
                  background: row.color ?? "var(--accent)",
                }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
