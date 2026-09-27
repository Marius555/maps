import { formatCount } from "@/lib/format/number";
import type { AnalyticsView } from "@/lib/analytics/view";
import { METRIC_COLOR } from "../charts/chart-colors";
import { LazyStackedBarChart } from "../charts/lazy";
import type { StackSeries } from "../charts/stacked-bar-chart";
import { SectionCard } from "../dashboard/section-card";
import { formatDay } from "../format";
import { ENGAGEMENT_SERIES } from "../sections";

type EngagementKey = keyof typeof ENGAGEMENT_SERIES;

/**
 * What visitors did, day by day, as stacked columns.
 *
 * The traffic chart above says how many came; this says what they did once
 * they were there — opened a location, searched, asked for directions, rang —
 * and whether a busy day was busy with lookers or with people setting off.
 *
 * A series with nothing in the range is left out of the stack and the legend,
 * and the card is not drawn at all when every one is empty (`engagementSeries`).
 * The legend carries each series' total, which is the reading the colours
 * alone would not give.
 */
export function EngagementCard({
  view,
  range,
}: {
  view: AnalyticsView;
  range: string;
}) {
  const series = engagementSeries(view);
  const keys = series.map((entry) => entry.key as EngagementKey);
  const data = view.daily.map((row) => ({
    day: row.day,
    ...Object.fromEntries(keys.map((key) => [key, row[key]])),
  }));

  return (
    <SectionCard title="What visitors did, by day" hint={range}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {series.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5 text-muted">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: entry.color }}
            />
            {entry.label}
            <span className="font-medium text-foreground tabular-nums">
              {formatCount(totalOf(view, entry.key as EngagementKey))}
            </span>
          </li>
        ))}
      </ul>

      <div className="an-chart mt-4 h-56" aria-hidden="true">
        <LazyStackedBarChart data={data} series={series} />
      </div>

      <table className="sr-only">
        <caption>What visitors did per day, {range.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {series.map((entry) => (
              <th key={entry.key} scope="col">
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.daily.map((row) => (
            <tr key={row.day}>
              <th scope="row">{formatDay(row.day)}</th>
              {keys.map((key) => (
                <td key={key}>{formatCount(row[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

/** The stack's series that have anything in the range, bottom to top. */
export function engagementSeries(view: AnalyticsView): StackSeries[] {
  return (Object.keys(ENGAGEMENT_SERIES) as EngagementKey[])
    .filter((key) => totalOf(view, key) > 0)
    .map((key) => ({
      key,
      label: ENGAGEMENT_SERIES[key],
      color: METRIC_COLOR[key],
    }));
}

function totalOf(view: AnalyticsView, key: EngagementKey): number {
  return view.totals[key].value;
}
