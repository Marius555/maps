/**
 * The Analytics page's own formatting, as a plain module.
 *
 * Plain rather than `"use client"` on purpose: the server-rendered cards and the
 * client-only charts both format dates and shares, and a value imported from a
 * client module into a server component is a client reference rather than the
 * value (CLAUDE.md §0). Functions would survive that; keeping every shared
 * helper here means nobody has to remember which ones would not.
 */

/**
 * `2026-09-07` → `7 Sep`.
 *
 * Built by hand from the parts rather than through `toLocaleDateString`, for the
 * reason `formatCount` pins its locale: this renders on the server and hydrates
 * in the browser, and a date formatted by two different runtimes' idea of the
 * locale is a hydration error that only appears on somebody else's machine.
 */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  const index = Number(month) - 1;

  if (!date || index < 0 || index > 11) return day;

  return `${String(Number(date))} ${MONTHS[index]}`;
}

/** A share of 0–1 as a whole percentage: 0.384 → "38%". */
export function formatShare(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}

/** "1 visit" / "3 visits". */
export function plural(count: number, [one, many]: readonly [string, string]): string {
  return count === 1 ? one : many;
}
