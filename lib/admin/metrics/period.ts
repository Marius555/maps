import type { Delta } from "@/lib/analytics/view";

/**
 * Day arithmetic for the operator console. Pure — every loader shapes its reads
 * through these, and `period.test.ts` pins them.
 *
 * Days are UTC `YYYY-MM-DD`, the same key `usage`, `mapSessions` and
 * `apiCalls` are written under, so a bucket here is the bucket there.
 */

export type DayPoint = { day: string; value: number };

export type Period = {
  /** The range, oldest first, ending today. */
  days: string[];
  /** The same number of days immediately before, oldest first. */
  previousDays: string[];
  fromDay: string;
  previousFromDay: string;
};

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shift(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function periodOf(range: number, now: Date = new Date()): Period {
  const all: string[] = [];

  for (let offset = range * 2 - 1; offset >= 0; offset -= 1) {
    all.push(toDay(shift(now, -offset)));
  }

  const previousDays = all.slice(0, range);
  const days = all.slice(range);

  return { days, previousDays, fromDay: days[0], previousFromDay: previousDays[0] };
}

/** How many of `timestamps` (ISO) fall on each of `days`. */
export function countByDay(timestamps: string[], days: string[]): DayPoint[] {
  const counts = new Map(days.map((day) => [day, 0]));

  for (const stamp of timestamps) {
    const day = stamp.slice(0, 10);
    const current = counts.get(day);
    if (current !== undefined) counts.set(day, current + 1);
  }

  return days.map((day) => ({ day, value: counts.get(day) ?? 0 }));
}

/** A series from a day → value map, zero-filled. */
export function seriesOf(values: Map<string, number>, days: string[]): DayPoint[] {
  return days.map((day) => ({ day, value: values.get(day) ?? 0 }));
}

export function sum(points: DayPoint[]): number {
  return points.reduce((total, point) => total + point.value, 0);
}

/** Null change for a previous period of zero — "New", never "+∞%". */
export function deltaOf(value: number, previous: number): Delta {
  return { value, previous, change: previous === 0 ? null : (value - previous) / previous };
}

/** Counts per key, biggest first, keys absent or empty folded into `fallback`. */
export function tallyBy<T>(
  items: T[],
  keyOf: (item: T) => string | null | undefined,
  fallback = "Unknown",
): { key: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyOf(item) || fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Whether an ISO time is within `days` days of `now`. */
export function withinDays(iso: string, days: number, now: Date = new Date()): boolean {
  if (!iso) return false;
  const time = Date.parse(iso);
  return Number.isFinite(time) && now.getTime() - time <= days * 86_400_000;
}
