"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS_TEXT, GRID } from "@/components/analytics/charts/chart-colors";
import { formatDay } from "@/components/analytics/format";
import { formatCount } from "@/lib/format/number";

export type DaySeries = { key: string; label: string; color: string };
type Day = { day: string } & Record<string, number | string>;

/** The gap, in the card's surface, between two segments of one column. */
const GAP = 2;
const RADIUS = 4;

/**
 * Several counts per day, stacked, with each day's column drawn as one piece.
 *
 * - The **topmost non-zero** segment of each day gets the rounded cap — the
 *   Analytics tab's chart rounds a fixed series, so a day where that series is
 *   zero ends square.
 * - Segments are parted by a 2px gap in the surface colour rather than a
 *   stroke, so no mark gains ink that is not data.
 * - `highlight` (a series key, from the legend or a hovered segment) dims every
 *   other series, so one provider can be followed across the period.
 */
export function StackedDaysChart({
  data,
  series,
  highlight,
  onHighlight,
}: {
  data: Day[];
  /** Bottom to top. */
  series: DaySeries[];
  highlight: string | null;
  onHighlight: (key: string | null) => void;
}) {
  const topOf = (entry: Day): string | undefined =>
    [...series].reverse().find((item) => Number(entry[item.key] ?? 0) > 0)?.key;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        barCategoryGap="22%"
        onMouseLeave={() => onHighlight(null)}
      >
        <CartesianGrid vertical={false} stroke={GRID} />

        <XAxis
          dataKey="day"
          tickFormatter={formatDay}
          tickLine={false}
          axisLine={false}
          tick={{ fill: AXIS_TEXT, fontSize: 11 }}
          tickMargin={8}
          minTickGap={28}
        />

        <YAxis
          allowDecimals={false}
          tickFormatter={(value: number) => formatCount(value)}
          tickLine={false}
          axisLine={false}
          tick={{ fill: AXIS_TEXT, fontSize: 11 }}
          width={40}
        />

        <Tooltip
          cursor={{ fill: "var(--surface-secondary)", radius: 6 }}
          content={<StackTooltip series={series} />}
        />

        {series.map((item) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId="day"
            fill={item.color}
            maxBarSize={24}
            fillOpacity={highlight && highlight !== item.key ? 0.25 : 1}
            onMouseEnter={() => onHighlight(item.key)}
            isAnimationActive="auto"
            shape={(props: unknown) => {
              const { x, y, width, height, fill, fillOpacity, payload } = props as {
                x: number;
                y: number;
                width: number;
                height: number;
                fill: string;
                fillOpacity?: number;
                payload: Day;
              };
              if (!height || height <= 0) return <g />;

              const isTop = topOf(payload) === item.key;
              const h = isTop ? height : Math.max(0, height - GAP);
              const top = isTop ? y : y + GAP;
              if (h <= 0) return <g />;

              if (!isTop) {
                return (
                  <rect x={x} y={top} width={width} height={h} fill={fill} fillOpacity={fillOpacity} />
                );
              }

              const r = Math.min(RADIUS, width / 2, h);
              const path = `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${top + h} Z`;
              return <path d={path} fill={fill} fillOpacity={fillOpacity} />;
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function StackTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: { payload?: Day }[];
  label?: string | number;
  series: DaySeries[];
}) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) return null;

  const rows = [...series]
    .reverse()
    .map((item) => ({ ...item, value: Number(entry[item.key] ?? 0) }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="min-w-40 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg shadow-black/10">
      <p className="flex items-baseline justify-between gap-4 font-medium text-foreground">
        <span>{formatDay(String(label ?? entry.day))}</span>
        <span className="tabular-nums">{formatCount(total)}</span>
      </p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-muted">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ background: row.color }} />
            <span>{row.label}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">{formatCount(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
