"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCount } from "@/lib/format/number";
import { ChartTooltip } from "./chart-tooltip";

export type BarRow = {
  key: string;
  label: string;
  value: number;
  /** This bar's own colour, when the rows are different metrics. */
  color?: string;
};

const BAR_PX = 10;

/**
 * A ranked list drawn as bars — "which controls did they press".
 *
 * **The label sits above its bar, not on an axis beside it.** A category axis
 * reserves a fixed column for the longest name ("Picked from the results
 * list"), which at phone width leaves the bars a sliver; above, the name has the
 * card's whole width and the bar does too. The count sits at the bar's tip —
 * one value per bar, which is the direct label and the reason there is no x
 * axis at all.
 *
 * Bars are capped at 10px with a rounded end and a square foot, and scaled
 * against the biggest row, so the longest bar is the busiest thing.
 */
export function BarListChart({
  rows,
  name,
  color,
}: {
  rows: BarRow[];
  /** What a bar counts, for the tooltip. */
  name: string;
  /** Every bar's colour unless the row brings its own. */
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        layout="vertical"
        // Room on the right for the count at the busiest bar's tip.
        margin={{ top: 16, right: 48, bottom: 0, left: 0 }}
        barCategoryGap={0}
      >
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="label" hide />

        <Tooltip
          cursor={{ fill: "var(--surface-secondary)" }}
          content={<ChartTooltip name={name} />}
        />

        <Bar
          dataKey="value"
          fill={color}
          barSize={BAR_PX}
          radius={[0, 4, 4, 0]}
          isAnimationActive="auto"
        >
          {rows.map((row) => (
            <Cell key={row.key} fill={row.color ?? color} />
          ))}
          <LabelList
            dataKey="label"
            content={(props) => (
              <text
                x={Number(props.x ?? 0)}
                y={Number(props.y ?? 0) - 7}
                fill="var(--foreground)"
                fontSize={13}
              >
                {String(props.value ?? "")}
              </text>
            )}
          />
          <LabelList
            dataKey="value"
            content={(props) => (
              <text
                x={Number(props.x ?? 0) + Number(props.width ?? 0) + 8}
                y={Number(props.y ?? 0) + BAR_PX / 2}
                dominantBaseline="central"
                fill="var(--muted)"
                fontSize={12}
                className="tabular-nums"
              >
                {formatCount(Number(props.value ?? 0))}
              </text>
            )}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
