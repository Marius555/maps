/**
 * Dates for the console, formatted by hand in UTC — the same reason
 * `components/analytics/format.ts` gives: server and browser must print the same
 * string, and `toLocaleDateString` answers differently per runtime.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-09-29T14:05:00Z` → `29 Sep 2026`; "" → "—". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return `${String(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${String(date.getUTCFullYear())}`;
}

/** `2026-09-29T14:05:00Z` → `29 Sep, 14:05`. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${String(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]}, ${hours}:${minutes}`;
}

/** A share of 0–1 with one decimal under 10%: 0.042 → "4.2%", 0.38 → "38%". */
export function formatPercent(share: number): string {
  const percent = share * 100;
  if (percent > 0 && percent < 10) return `${percent.toFixed(1)}%`;
  return `${String(Math.round(percent))}%`;
}
