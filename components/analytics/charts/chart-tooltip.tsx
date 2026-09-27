"use client";

import { formatCount } from "@/lib/format/number";

/** What recharts hands a custom tooltip, narrowed to the parts used here. */
export type TooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: {
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: Record<string, unknown>;
  }[];
};

/**
 * The one tooltip every Analytics chart uses.
 *
 * Drawn from the app's own surface and ink tokens rather than recharts' white
 * box, which is invisible on the dark theme. The value leads and the name
 * follows — the reader already knows the series and wants the number — and the
 * short stroke beside it is the only thing wearing the series colour. Text
 * stays in text ink.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  title,
  name,
}: TooltipProps & {
  /** The heading, from the hovered label — a date, a device, a country. */
  title?: (label: string) => string;
  /** The series' name, when the chart only has one and recharts has none. */
  name?: string;
}) {
  if (!active || !payload?.length) return null;

  const heading = title ? title(String(label ?? "")) : label;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg shadow-black/10">
      {heading ? (
        <p className="font-medium text-foreground">{heading}</p>
      ) : null}

      <ul className={heading ? "mt-1 space-y-0.5" : "space-y-0.5"}>
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2 text-muted">
            <span
              aria-hidden="true"
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="font-semibold text-foreground tabular-nums">
              {formatCount(Number(entry.value ?? 0))}
            </span>
            <span>{name ?? entry.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
