"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartTooltip } from "./chart-tooltip";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * A part-to-whole of a handful of slices, with the whole in the middle.
 *
 * Only ever drawn beside a legend that lists every slice with its share (see
 * the cards that use it), so the chart is the picture and the list is the
 * reading. Slices are parted by a 2px stroke in the card's own colour — the
 * surface gap — rather than an outline, and hovering one names it.
 *
 * The centre figure is HTML over the chart rather than SVG text inside it: it
 * wears the app's type styles and needs no measuring.
 */
export function DonutChart({
  slices,
  total,
  caption,
  name,
}: {
  slices: DonutSlice[];
  /** The figure in the middle, already formatted. */
  total: string;
  /** What the middle figure counts: "visits". */
  caption: string;
  /** What a slice's value counts, for the tooltip. */
  name: string;
}) {
  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={<ChartTooltip name={name} />}
            wrapperStyle={{ zIndex: 20 }}
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive="auto"
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
      >
        <span className="text-xl font-semibold tracking-tight text-foreground">
          {total}
        </span>
        <span className="text-xs text-muted">{caption}</span>
      </div>
    </div>
  );
}
