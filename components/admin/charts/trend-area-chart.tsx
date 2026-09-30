"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS_TEXT, GRID } from "@/components/analytics/charts/chart-colors";
import { formatDay } from "@/components/analytics/format";
import type { DayPoint } from "@/lib/admin/metrics/period";
import { formatCount } from "@/lib/format/number";

type Row = { day: string; value: number; previous?: number; previousDay?: string };

/** An average worth printing: one decimal under ten, whole numbers above. */
function formatAverage(value: number): string {
  return value < 10 ? String(Math.round(value * 10) / 10) : formatCount(Math.round(value));
}

/**
 * One figure per day across the period, read against the period before.
 *
 * Four layers, each answering its own question:
 * - the area — the shape of this period;
 * - a dashed muted line — the same days of the period before, aligned by
 *   position, so "is this better than last time" is answered by looking;
 * - a dashed average line with its value printed — what a typical day was;
 * - the peak day marked with its value — the one number worth labelling.
 *
 * The tooltip gives the hovered day beside its counterpart and the change.
 * The previous line and the average are left out when there is nothing to say
 * (no previous series; an all-zero period).
 */
export function TrendAreaChart({
  data,
  previous,
  name,
  color,
}: {
  data: DayPoint[];
  /** The same number of days immediately before, oldest first. */
  previous?: DayPoint[];
  name: string;
  color: string;
}) {
  const gradient = `trend-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const rows: Row[] = data.map((point, index) => ({
    day: point.day,
    value: point.value,
    previous: previous?.[index]?.value,
    previousDay: previous?.[index]?.day,
  }));

  const total = data.reduce((sum, point) => sum + point.value, 0);
  const average = data.length > 0 ? total / data.length : 0;
  const peak = data.reduce<DayPoint | null>(
    (best, point) => (point.value > (best?.value ?? 0) ? point : best),
    null,
  );
  const hasPrevious = Boolean(previous?.some((point) => point.value > 0));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
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
          cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" }}
          content={<TrendTooltip name={name} color={color} />}
        />

        {hasPrevious ? (
          <Line
            type="monotone"
            dataKey="previous"
            stroke="var(--muted)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            isAnimationActive="auto"
          />
        ) : null}

        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`url(#${gradient})`}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)", fill: color }}
          isAnimationActive="auto"
        />

        {average > 0 ? (
          <ReferenceLine
            y={average}
            stroke="var(--muted)"
            strokeOpacity={0.7}
            strokeDasharray="2 4"
            label={{
              value: `avg ${formatAverage(average)}/day`,
              position: "insideBottomLeft",
              fill: AXIS_TEXT,
              fontSize: 11,
            }}
          />
        ) : null}

        {peak ? (
          <ReferenceDot
            x={peak.day}
            y={peak.value}
            r={4}
            fill={color}
            stroke="var(--surface)"
            strokeWidth={2}
            label={{
              value: formatCount(peak.value),
              position: "top",
              offset: 8,
              fill: "var(--foreground)",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TrendTooltip({
  active,
  payload,
  name,
  color,
}: {
  active?: boolean;
  payload?: { payload?: Row }[];
  name: string;
  color: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const change =
    row.previous !== undefined && row.previous > 0
      ? Math.round(((row.value - row.previous) / row.previous) * 100)
      : null;

  return (
    <div className="min-w-40 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg shadow-black/10">
      <p className="font-medium text-foreground">{formatDay(row.day)}</p>
      <p className="mt-1 flex items-center gap-2 text-muted">
        <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
        <span className="font-semibold text-foreground tabular-nums">{formatCount(row.value)}</span>
        <span>{name}</span>
      </p>
      {row.previous !== undefined && row.previousDay ? (
        <p className="mt-0.5 flex items-center gap-2 text-muted">
          <span aria-hidden="true" className="w-3 shrink-0 border-t border-dashed border-muted" />
          <span className="tabular-nums">{formatCount(row.previous)}</span>
          <span>on {formatDay(row.previousDay)}</span>
          {change !== null && change !== 0 ? (
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {change > 0 ? "+" : "−"}
              {Math.abs(change)}%
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
