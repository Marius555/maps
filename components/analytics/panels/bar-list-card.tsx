import { formatCount } from "@/lib/format/number";
import { BAR_ROW_PX } from "../charts/chart-colors";
import type { BarRow } from "../charts/bar-list-chart";
import { LazyBarListChart } from "../charts/lazy";
import { SectionCard } from "../dashboard/section-card";

/**
 * A ranked list drawn as horizontal bars, in a card.
 *
 * The chart's box is sized here from the row count, so the card is its final
 * height from the server render on. The sr-only list under it is the
 * accessible reading — a chart of fifteen bars is fifteen stops that each say
 * nothing to a screen reader.
 */
export function BarListCard({
  title,
  hint,
  rows,
  name,
  color,
  className,
}: {
  title: string;
  hint?: string;
  rows: BarRow[];
  /** What a bar counts, for the tooltip. */
  name: string;
  /** The bars' colour: the metric they count. */
  color: string;
  className?: string;
}) {
  return (
    <SectionCard title={title} hint={hint} className={className}>
      <div
        className="an-chart"
        style={{ height: rows.length * BAR_ROW_PX + 16 }}
        aria-hidden="true"
      >
        <LazyBarListChart rows={rows} name={name} color={color} />
      </div>

      <ul className="sr-only">
        {rows.map((row) => (
          <li key={row.key}>
            {row.label}: {formatCount(row.value)}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
