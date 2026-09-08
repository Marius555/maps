/**
 * The window the Analytics tab is looking at, in whole UTC days.
 *
 * **Days, not instants, and UTC rather than the owner's zone.** A session is
 * stored with a `day` bucket key that the monthly ceiling and the daily rollup
 * both group on, so a range that did not line up with those keys would need a
 * second query shape and would disagree with the rollups it reads. One customer
 * seeing "today" start an hour early is a smaller problem than two figures on
 * one page that cannot be made to add up.
 *
 * Pure and client-safe: no `server-only`, no clock of its own. `now` is always
 * passed in, for the reason `buildSnapshot` takes `generatedAt` — a function
 * that reads the clock cannot be tested without freezing it.
 */

export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/**
 * Thirty days rather than seven.
 *
 * Seven is what a busy site wants and what a store locator cannot fill: a map
 * on a shop's Find Us page might see a few dozen sessions a week, and a chart of
 * seven near-empty days reads as "this feature is broken" rather than "this is
 * a quiet week".
 */
export const DEFAULT_RANGE: AnalyticsRange = "30d";

const DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function rangeDays(range: AnalyticsRange): number {
  return DAYS[range];
}

/**
 * A range off a search param, falling back rather than throwing.
 *
 * The same rule `readFilter` follows on the Locations page: a URL is something
 * a person can type, and an unknown value should land them on the default view
 * rather than on an error.
 */
export function readRange(value: unknown): AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange)
    ? (value as AnalyticsRange)
    : DEFAULT_RANGE;
}

/** `YYYY-MM-DD`, UTC. The bucket key every stored row is grouped by. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);

  return utcDay(date);
}

export type DayWindow = {
  /** Inclusive. */
  from: string;
  /** Inclusive, and always today — a range always ends now. */
  to: string;
};

/**
 * The window a range covers, ending today.
 *
 * Inclusive at both ends, and `rangeDays - 1` back rather than `rangeDays`:
 * "7 days" means today and the six before it, which is seven columns on the
 * chart. Counting a full seven back would draw eight.
 */
export function dayWindow(range: AnalyticsRange, now: Date): DayWindow {
  const to = utcDay(now);

  return { from: addDays(to, -(rangeDays(range) - 1)), to };
}

/**
 * The window immediately before this one, the same length.
 *
 * What every "up 12%" on the page is measured against. Ending the day before
 * `from` rather than overlapping it, so a session is never counted in both.
 */
export function previousWindow(window: DayWindow, range: AnalyticsRange): DayWindow {
  const to = addDays(window.from, -1);

  return { from: addDays(to, -(rangeDays(range) - 1)), to };
}

/** Every day in a window, in order. Days with nothing in them included. */
export function daysIn(window: DayWindow): string[] {
  const days: string[] = [];

  for (let day = window.from; day <= window.to; day = addDays(day, 1)) {
    days.push(day);

    // A malformed `from` would otherwise spin forever. The guard is cheap and
    // this runs on a request.
    if (days.length > 400) break;
  }

  return days;
}
