import { formatCount } from "@/lib/format/number";
import { LazyDonutChart } from "../charts/lazy";
import { OTHER_COLOR, SLICE_COLORS, topWithOther } from "../charts/chart-colors";
import { SectionCard } from "../dashboard/section-card";
import { formatShare } from "../format";
import { RankList } from "./rank-list";

/**
 * A part-to-whole as a donut with its legend — devices, countries.
 *
 * The donut is the picture and the list beside it is the reading: every slice
 * is named there with its count and share, beside a swatch of the slice's
 * colour, so identity never rests on telling two greys apart. Past four slices
 * the rest fold into "Other" in the donut; the list keeps the first few rows by
 * name and says what the rest add up to.
 *
 * **Colour follows the slice, not its rank**, when the slices are metrics:
 * pass `colors` and directions are violet whether they are the biggest slice
 * or the smallest. Without it (devices, countries) slices take the generic
 * run in order, and "Other" is always the grey.
 *
 * **One row draws no donut.** A ring that is all one colour is a picture of
 * "100%", which the row already says in words; the card is then the list alone.
 */
export function ShareDonutCard({
  title,
  hint,
  rows,
  name,
  unit,
  colors,
  className,
}: {
  title: string;
  hint?: string;
  rows: { key: string; count: number }[];
  /** A row's display name from its key. */
  name: (key: string) => string;
  /** What is counted: ["visit", "visits"]. */
  unit: readonly [string, string];
  /** A fixed colour per key, for slices that are metrics. */
  colors?: Record<string, string>;
  className?: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const slices = topWithOther(rows, colors ? rows.length : undefined).map((row, index) => ({
    key: row.key,
    label: row.other ? "Other" : name(row.key),
    value: row.count,
    color: row.other
      ? OTHER_COLOR
      : (colors?.[row.key] ?? SLICE_COLORS[index] ?? OTHER_COLOR),
  }));

  return (
    <SectionCard title={title} hint={hint} className={className}>
      {/* Side by side only when the *card* has the room, not the screen: the
          same card sits in a third of a row and in a quarter of one. */}
      <div className="@container">
        <div className="flex flex-col items-center gap-5 @sm:flex-row">
          {slices.length > 1 ? (
            <div className="an-chart size-40 shrink-0" aria-hidden="true">
              <LazyDonutChart
                slices={slices}
                total={formatCount(total)}
                caption={total === 1 ? unit[0] : unit[1]}
                name={unit[1]}
              />
            </div>
          ) : null}

          <div className="w-full min-w-0 flex-1">
            <RankList
              rows={slices.map((slice) => ({
                key: slice.key,
                name: <span className="text-foreground">{slice.label}</span>,
                count: slice.value,
                detail: total > 0 ? formatShare(slice.value / total) : undefined,
                color: slice.color,
              }))}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
