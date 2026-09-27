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

import { formatCount } from "@/lib/format/number";
import { formatDay } from "../format";
import { AXIS_TEXT, GRID } from "./chart-colors";
import { ChartTooltip } from "./chart-tooltip";

export type StackSeries = { key: string; label: string; color: string };

/**
 * Several counts per day, stacked — "what visitors did, day by day".
 *
 * Columns rather than an area: each day is a sum of separate acts, and a
 * column's segments are that sum made visible. Each segment is parted from the
 * next by a hairline in the card's own colour (the surface gap), which is also
 * what keeps two hues apart for a reader who cannot tell them apart by hue.
 *
 * Only the top series has rounded corners. On a day where it is zero the column
 * ends square, which is the price of recharts not knowing which segment is on
 * top — cheaper than computing a radius per day per series.
 *
 * The legend is the card's, in HTML above the chart; the tooltip lists every
 * segment of the hovered day.
 */
export function StackedBarChart({
  data,
  series,
}: {
  data: ({ day: string } & Record<string, number | string>)[];
  /** Bottom to top. */
  series: StackSeries[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        // Ninety columns at card width leave little room; a narrow gap keeps
        // each column wide enough to hover.
        barCategoryGap="18%"
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
          cursor={{ fill: "var(--surface-secondary)" }}
          content={<ChartTooltip title={formatDay} />}
        />

        {series.map((entry, index) => (
          <Bar
            key={entry.key}
            dataKey={entry.key}
            name={entry.label}
            stackId="day"
            fill={entry.color}
            stroke="var(--surface)"
            strokeWidth={1}
            radius={index === series.length - 1 ? [3, 3, 0, 0] : 0}
            isAnimationActive="auto"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
