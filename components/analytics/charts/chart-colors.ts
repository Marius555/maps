/**
 * The Analytics charts' colours, as CSS references.
 *
 * References rather than values, so light and dark are one definition each in
 * `globals.css` (`--an-*`) and every chart follows the theme without reading
 * it. Recharts passes these straight through to SVG attributes, where a `var()`
 * resolves like it does in a stylesheet.
 *
 * **Colour follows the metric, never its rank.** Visitors are blue wherever
 * they are drawn — their headline card, its sparkline, the traffic chart, the
 * "Came back" meter — so a reader who learns the colour once can read every
 * chart on the page by it. This is the recorded exception to the "accent is
 * the only chromatic voice" rule; the reasoning and the validator's numbers are
 * beside the tokens.
 *
 * A plain module, not `"use client"`: the server-rendered cards import these
 * too, and a constant read through a client reference is not the constant.
 */

export const METRIC_COLOR = {
  visitors: "var(--an-visitors)",
  sessions: "var(--an-visits)",
  opens: "var(--an-opens)",
  searches: "var(--an-searches)",
  directions: "var(--an-directions)",
  calls: "var(--an-calls)",
  site: "var(--an-site)",
  email: "var(--an-email)",
} as const;

export type Metric = keyof typeof METRIC_COLOR;

/** The folded "Other" slice, and anything else that is not a metric. */
export const OTHER_COLOR = "var(--an-other)";

/**
 * Which metric a tracked event *is*, where it is one — so the "What they did"
 * bar for searching is the same yellow as searches everywhere else. The rest
 * (clicked a pin, zoomed a cluster) are not a headline metric and stay grey.
 */
const EVENT_METRIC: Record<string, Metric> = {
  open: "opens",
  search: "searches",
  directions: "directions",
  tel: "calls",
  email: "email",
  site: "site",
};

export function eventColor(key: string): string {
  const metric = EVENT_METRIC[key];
  return metric ? METRIC_COLOR[metric] : OTHER_COLOR;
}

/**
 * Slices of a part-to-whole whose parts are not metrics — devices, countries.
 * The dataviz reference order's first three hues, which validate all-pairs in
 * both modes; a fourth slice is always "Other" (see `topWithOther`).
 */
export const SLICE_COLORS = [
  "var(--an-visitors)",
  "var(--an-visits)",
  "var(--an-opens)",
  OTHER_COLOR,
] as const;

/**
 * One row of `BarListChart`: a label line above a 10px bar, and air under it.
 * Here rather than beside the chart because the server-rendered card sizes the
 * chart's box from it, and the chart's own module is a client one.
 */
export const BAR_ROW_PX = 42;

/** Bars drawn by name before the rest are left to the tables. */
export const BAR_ROWS_SHOWN = 8;

/** Hairline grid and axis ink. */
export const GRID = "var(--border)";
export const AXIS_TEXT = "var(--muted)";

/**
 * The icon chip behind a headline card's icon: the metric's own hue, weak
 * enough that the icon on it still reads. `color-mix` because the tokens are
 * hex and a `var()` cannot take an alpha suffix.
 */
export function softOf(color: string): string {
  return `color-mix(in oklab, ${color} 16%, transparent)`;
}

/**
 * The largest three entries, and everything else as one "Other" entry.
 *
 * Three because that is how many hues validate all-pairs; a fourth named slice
 * would wear the grey "Other" wears. So a donut stops at three and says what
 * the rest add up to rather than generating a hue.
 */
export function topWithOther<T extends { key: string; count: number }>(
  rows: T[],
  /** More only when every slice has a colour of its own (metric slices). */
  named: number = SLICE_COLORS.length - 1,
): { key: string; count: number; other: boolean }[] {
  if (rows.length <= named) {
    return rows.map((row) => ({ key: row.key, count: row.count, other: false }));
  }

  const head = rows.slice(0, named);
  const rest = rows.slice(named).reduce((total, row) => total + row.count, 0);

  return [
    ...head.map((row) => ({ key: row.key, count: row.count, other: false })),
    { key: "other", count: rest, other: true },
  ];
}
