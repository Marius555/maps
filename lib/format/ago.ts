/**
 * How long ago, as a number and a short unit: "12 min ago", "1 h ago",
 * "3 d ago", "2 weeks ago". The Shopify Publish footer's "Live · …", which the
 * owner wanted as numbers rather than date-fns's "less than a minute ago" — and
 * coarse, worked out once, with no counter running (2026-11-03).
 *
 * Labels are written out rather than left to `Intl`, whose compact notation
 * disagrees between Node and Chrome (CLAUDE.md, invariants). Each unit is
 * floored, so "1 h" means at least a whole hour. Never below "1 min": under a
 * minute, and a clock a little ahead of the server's, both read as just done.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function shortAgo(elapsedMs: number): string {
  const ms = Number.isFinite(elapsedMs) ? Math.max(elapsedMs, 0) : 0;

  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MINUTE))} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  if (ms < WEEK) return `${Math.floor(ms / DAY)} d ago`;

  if (ms < MONTH) {
    const weeks = Math.floor(ms / WEEK);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  if (ms < YEAR) return `${Math.floor(ms / MONTH)} mo ago`;
  return `${Math.floor(ms / YEAR)} yr ago`;
}

/** `shortAgo` from an ISO timestamp to now. */
export function publishedAgo(iso: string): string {
  return shortAgo(Date.now() - Date.parse(iso));
}
