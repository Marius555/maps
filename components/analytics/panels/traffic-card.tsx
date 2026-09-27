"use client";

import { Label, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";

import { formatCount } from "@/lib/format/number";
import type { DailyRow } from "@/lib/analytics/view";
import { METRIC_COLOR } from "../charts/chart-colors";
import { LazyTrafficChart } from "../charts/lazy";
import { SectionCard } from "../dashboard/section-card";
import { formatDay, plural } from "../format";
import { TRAFFIC_SERIES, type TrafficSeries } from "../sections";

/**
 * The period, day by day — the Overview's main chart.
 *
 * One series at a time with a switch above it, rather than four lines on one
 * plot: visits and searches differ by an order of magnitude on most maps, and
 * sharing an axis would press the smaller one flat against the floor. Four
 * charts would be four times the height for the same answer.
 *
 * A series with nothing in the period has no button. A switch to a flat line at
 * zero is a control that shows nothing, which reads as broken.
 *
 * The header's figure is the period's own total from the headline row, never a
 * sum of the days: visitors are counted once across the whole range, so the
 * days of that series do not add up to it (see `DailyRow`).
 */
export function TrafficCard({
  daily,
  totals,
  range,
  className,
}: {
  daily: DailyRow[];
  totals: Record<TrafficSeries, number>;
  range: string;
  className?: string;
}) {
  const available = (Object.keys(TRAFFIC_SERIES) as TrafficSeries[]).filter(
    (series) => series === "sessions" || totals[series] > 0,
  );
  const [series, setSeries] = useState<TrafficSeries>("sessions");
  const meta = TRAFFIC_SERIES[series];

  const data = daily.map((row) => ({ day: row.day, value: row[series] }));
  const peak = data.reduce((most, point) => (point.value > most.value ? point : most), data[0]);
  const total = totals[series];

  return (
    <SectionCard
      title="Traffic"
      hint={range}
      className={className}
      action={
        available.length > 1 ? (
          <ToggleButtonGroup
            size="sm"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[series]}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (typeof next === "string" && next in TRAFFIC_SERIES) {
                setSeries(next as TrafficSeries);
              }
            }}
          >
            <Label className="sr-only">What the chart shows</Label>
            {available.map((id, index) => (
              <ToggleButton key={id} id={id}>
                {index > 0 ? <ToggleButtonGroup.Separator /> : null}
                {/* The series' own colour, so the switch is also the legend. */}
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: METRIC_COLOR[id] }}
                />
                {TRAFFIC_SERIES[id].label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        ) : null
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          {formatCount(total)}
          <span className="ml-1.5 text-sm font-normal text-muted">
            {plural(total, meta.noun)}
          </span>
        </p>
        {peak && peak.value > 0 ? (
          <p className="text-xs text-muted">
            Busiest day {formatDay(peak.day)}, with {formatCount(peak.value)}
          </p>
        ) : null}
      </div>

      <div className="an-chart mt-4 h-56 sm:h-64" aria-hidden="true">
        <LazyTrafficChart
          data={data}
          name={plural(2, meta.noun)}
          color={METRIC_COLOR[series]}
        />
      </div>

      {/* The accessible reading: a table of every day, not a picture of it. */}
      <table className="sr-only">
        <caption>
          {meta.label} per day, {range.toLowerCase()}
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{meta.label}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.day}>
              <th scope="row">{formatDay(point.day)}</th>
              <td>{formatCount(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}
