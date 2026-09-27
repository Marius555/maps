"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
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
import type { SparkPoint } from "./sparkline";

/**
 * One figure per day across the range — the Overview's main chart.
 *
 * An area rather than columns: across ninety days a column chart is ninety
 * slivers, and the question here is the shape of the period, which a line
 * answers directly. Hairline horizontal grid only, solid and in the border
 * token; y ticks rounded to whole numbers because nobody had half a visit.
 *
 * The x axis prints a handful of dates and lets recharts thin them
 * (`minTickGap`) rather than a date per day, which at phone width is a smear.
 */
export function TrafficChart({
  data,
  name,
  color,
}: {
  data: SparkPoint[];
  name: string;
  /** The series' metric colour, so it matches its headline card. */
  color: string;
}) {
  const gradient = `traffic-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

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
          cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
          content={<ChartTooltip name={name} title={formatDay} />}
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradient})`}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)", fill: color }}
          isAnimationActive="auto"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
