"use client";

import { useState } from "react";

import { formatDay } from "@/components/analytics/format";
import type { DayPoint } from "@/lib/admin/metrics/period";
import type { DataSource } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { LazyStackedDaysChart, LazyTrendAreaChart } from "../charts/lazy";
import { SeriesLegend } from "../charts/series-legend";
import type { DaySeries } from "../charts/stacked-days-chart";
import { SourceBadge } from "./source-badge";

type StackedDay = { day: string } & Record<string, number | string>;

export type MetricChart =
  | { kind: "line"; data: DayPoint[]; previous?: DayPoint[]; name: string }
  | { kind: "stacked"; data: StackedDay[]; series: (DaySeries & { total?: number })[] };

/** Nothing happened in the period: the tab would draw a flat line at zero. */
export function isEmptyChart(chart: MetricChart): boolean {
  if (chart.kind === "line") return chart.data.every((point) => point.value === 0);

  return chart.data.every((entry) =>
    chart.series.every((series) => Number(entry[series.key] ?? 0) === 0),
  );
}

/**
 * One tab's panel: a header row (legend on the left, where the figure comes
 * from on the right) over a chart box of fixed height. Line and stacked panels
 * have the same two rows at the same heights — a legend on both — so switching
 * between them never changes the card's size.
 */
export function MetricPanel({
  label,
  color,
  source,
  chart,
}: {
  label: string;
  color: string;
  source: DataSource;
  chart: MetricChart;
}) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const days = chart.data.length;

  const legend =
    chart.kind === "line"
      ? [
          { key: "current", label: `Last ${String(days)} days`, color },
          ...(chart.previous?.some((point) => point.value > 0)
            ? [{ key: "previous", label: `${String(days)} days before`, color: "var(--muted)", dashed: true }]
            : []),
        ]
      : chart.series;

  return (
    <div>
      <div className="flex h-7 items-center justify-between gap-3">
        <SeriesLegend
          items={legend}
          highlight={chart.kind === "stacked" ? highlight : null}
          onHighlight={chart.kind === "stacked" ? setHighlight : undefined}
        />
        <SourceBadge source={source} />
      </div>

      <div className="an-chart mt-3 h-64 sm:h-72" aria-hidden="true">
        {chart.kind === "line" ? (
          <LazyTrendAreaChart data={chart.data} previous={chart.previous} name={chart.name} color={color} />
        ) : (
          <LazyStackedDaysChart
            data={chart.data}
            series={chart.series}
            highlight={highlight}
            onHighlight={setHighlight}
          />
        )}
      </div>

      {chart.kind === "line" ? (
        <DayTable
          caption={`${label} per day`}
          columns={[label]}
          rows={chart.data.map((point) => ({ day: point.day, values: [point.value] }))}
        />
      ) : (
        <DayTable
          caption={`${label} per day`}
          columns={chart.series.map((series) => series.label)}
          rows={chart.data.map((entry) => ({
            day: entry.day,
            values: chart.series.map((series) => Number(entry[series.key] ?? 0)),
          }))}
        />
      )}
    </div>
  );
}

/** The accessible reading of a chart: a table of every day, not a picture of it. */
function DayTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: { day: string; values: number[] }[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Day</th>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.day}>
            <th scope="row">{formatDay(row.day)}</th>
            {row.values.map((value, index) => (
              <td key={columns[index]}>{formatCount(value)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
