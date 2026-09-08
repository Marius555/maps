import "server-only";

import {
  listDailyRollups,
  listRecentSessions,
  listSessions,
  writeDailyRollup,
  type DailyRollup,
} from "@/lib/repositories/analytics.repository";
import type { RepoContext } from "@/lib/repositories/context";
import type { Place } from "@/lib/repositories/types";
import {
  emptyFold,
  foldByDay,
  foldToTotals,
  totalsToFold,
  type DayFold,
} from "./fold";
import {
  dayWindow,
  daysIn,
  previousWindow,
  utcDay,
  type AnalyticsRange,
} from "./range";
import { buildView, type AnalyticsView } from "./view";

/**
 * Everything the Analytics page draws, assembled.
 *
 * **The rollup is written here, on a read.** There is no cron and no scheduled
 * function in this project — §12 records that Vercel Hobby caps cron at once
 * daily, and an Appwrite Function would be a new deploy target — so a completed
 * day is folded the first time anybody asks for a range containing it, and read
 * from `mapDaily` every time after. Today is never rolled up, because it is
 * still changing.
 *
 * The cost of a warm load is four reads: the rollups for the range, the rollups
 * for the period it is compared against, today's raw sessions, and one page of
 * recent sessions for the visitors table. A cold load pays once more, for the
 * days it has to fold — after which every range containing them is warm.
 *
 * The writes are deliberately **not awaited into the render**: see `roll` below.
 */

export type AnalyticsData = {
  view: AnalyticsView;
  /**
   * The read hit its page ceiling, so the figures cover only the most recent
   * sessions in the range. Surfaced rather than swallowed — a number that is
   * quietly partial is worse than one that says so.
   */
  truncated: boolean;
};

export async function loadAnalytics(
  ctx: RepoContext,
  mapId: string,
  range: AnalyticsRange,
  places: Place[],
  now: Date,
): Promise<AnalyticsData> {
  const window = dayWindow(range, now);
  const previous = previousWindow(window, range);
  const today = utcDay(now);

  /*
   * Both windows' rollups in one go — the range on screen and the one every
   * "+12%" is measured against.
   *
   * The previous window is a real part of the load rather than a cheap extra,
   * and it was a mistake to treat it as one: reading only its *stored* rollups
   * meant a map's first ever visit to this page had nothing to compare against
   * and every tile read "No earlier period yet", which is not a fact about the
   * map. Its days are folded and stored exactly like the visible ones, so the
   * cost is paid once and the second load of any range is cheap.
   */
  const [rollups, previousRollups, recent] = await Promise.all([
    listDailyRollups(ctx, mapId, window.from, window.to),
    listDailyRollups(ctx, mapId, previous.from, previous.to),
    listRecentSessions(ctx, mapId, window.from, window.to),
  ]);

  const rolled = new Map(
    [...previousRollups, ...rollups].map((rollup) => [rollup.day, rollup]),
  );

  /*
   * Which raw days still have to be read: today, always, plus every earlier day
   * across both windows that has no rollup. Read as one range rather than day by
   * day — on a warm map that range is just today, because everything behind it
   * has been folded already.
   */
  const covered = daysIn({ from: previous.from, to: window.to });
  const missing = covered.filter((day) => day === today || !rolled.has(day));

  const earliest = missing[0] ?? today;
  const { sessions, truncated } = await listSessions(
    ctx,
    mapId,
    earliest,
    window.to,
  );

  const rawByDay = foldByDay(sessions);

  // Completed days folded from a complete read are worth storing. Today is not,
  // and neither is anything from a truncated read.
  if (!truncated) {
    void roll(ctx, mapId, rawByDay, today, rolled);
  }

  const days = daysIn(window).map((day) => ({
    day,
    fold: foldFor(day, rawByDay, rolled),
  }));

  return {
    view: buildView({
      days,
      previousDays: daysIn(previous).map((day) =>
        foldFor(day, rawByDay, rolled),
      ),
      allDays: daysIn(window),
      places: places.map((place) => ({
        id: place.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
      })),
      recent,
    }),
    truncated,
  };
}

/**
 * A day's numbers: the raw fold when we read one, else the stored rollup, else
 * nothing.
 *
 * Raw wins on purpose. The only day that has both is today, whose rollup should
 * not exist — and if one does (a clock skew, a hand-written row) the live count
 * is the true one.
 */
function foldFor(
  day: string,
  raw: Map<string, DayFold>,
  rolled: Map<string, DailyRollup>,
): DayFold {
  const fresh = raw.get(day);
  if (fresh) return fresh;

  const rollup = rolled.get(day);

  return rollup ? foldOfRollup(rollup) : emptyFold();
}

function foldOfRollup(rollup: DailyRollup): DayFold {
  return totalsToFold(rollup.totals, {
    sessions: rollup.sessions,
    views: rollup.views,
    interactions: rollup.interactions,
  });
}

/**
 * Store every completed day we just folded, without making the page wait.
 *
 * Not awaited, and that is the whole reason this is a separate function: the
 * page has all its numbers already, and blocking the render on writes that only
 * make the *next* load faster would be paying today's visitor for tomorrow's.
 * A failed write is not an error the owner can act on either — the day is simply
 * folded again next time — so it is logged and dropped rather than thrown.
 *
 * Concurrency is handled by the unique index on `(mapId, day)`: two requests
 * entering here together produce one row and one swallowed 409, which is what
 * that index is for.
 */
async function roll(
  ctx: RepoContext,
  mapId: string,
  raw: Map<string, DayFold>,
  today: string,
  rolled: Map<string, DailyRollup>,
): Promise<void> {
  for (const [day, fold] of raw) {
    if (day >= today || rolled.has(day)) continue;

    try {
      await writeDailyRollup(ctx, mapId, {
        day,
        sessions: fold.sessions,
        views: fold.views,
        interactions: fold.interactions,
        totals: foldToTotals(fold),
      });
    } catch (error) {
      console.error(`Couldn't roll up ${mapId} for ${day}:`, error);
      return;
    }
  }
}
