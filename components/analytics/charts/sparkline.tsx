"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDay } from "../format";
import { ChartTooltip } from "./chart-tooltip";

export type SparkPoint = { day: string; value: number };

/**
 * The shape of one headline figure over the range, under the figure itself.
 *
 * No axes and no grid: it answers "rising, falling or flat, and was there a
 * spike", and the exact numbers are one hover away and in the traffic chart.
 * A wash rather than a filled block — the metric's colour at a fifth of its
 * strength fading to nothing — so four of these in a row read as texture under
 * four numbers rather than four more things to look at.
 *
 * **The margin is at least the stroke width on every side.** A day at zero
 * draws its line exactly on the plot's floor, and with a zero bottom margin
 * that floor is the SVG's own edge — half the 2px stroke was cut off, so a
 * quiet stretch read as a hairline next to a full-weight curve.
 *
 * Loaded through `./lazy.tsx`; recharts measures its box and has nothing to
 * draw on the server.
 */
export function Sparkline({
  data,
  name,
  color,
}: {
  data: SparkPoint[];
  /** What a point counts, for the tooltip: "visits". */
  name: string;
  /** The metric's colour — `METRIC_COLOR` in `./chart-colors`. */
  color: string;
}) {
  // A gradient is referenced by id, and `useId`'s output is not a valid one
  // inside `url(#…)` in every React version.
  const gradient = `spark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 3, bottom: 3, left: 3 }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Hidden, but it is what makes the tooltip's label the day rather
            than the point's index. */}
        <XAxis dataKey="day" hide />
        {/* Zero is the floor, always: an all-zero range otherwise gets a
            domain of [0, 0] and recharts floats the line mid-box. */}
        <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />

        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={<ChartTooltip name={name} title={formatDay} />}
          wrapperStyle={{ zIndex: 20 }}
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradient})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: color }}
          isAnimationActive="auto"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
