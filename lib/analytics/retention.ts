import "server-only";

import {
  deleteDaySessions,
  hasDailyRollup,
  listMapsForRetention,
  oldestExpiredDay,
  readDaySessions,
  storeDailyRollup,
} from "@/lib/repositories/analytics.repository";
import {
  getUserPlan,
  SESSION_LIMITS,
  type PlanId,
} from "@/lib/repositories/plan-limits";
import { foldByDay, foldToTotals } from "./fold";
import { addDays, utcDay } from "./range";

/**
 * Raw visitor sessions are kept for the map owner's plan's `retentionDays`
 * (30 / 180 / 365) and then deleted — what the Privacy Policy §6 and the DPA's
 * Annex I.B promise. docs/notes/analytics.md, "Retention".
 *
 * **A day is folded before it is deleted.** Rollups are written lazily, on the
 * first Analytics read of a range containing the day, so a map nobody looked at
 * for a month has days with no rollup. Deleting their sessions first would erase
 * those days from the charts for good; folding them here writes exactly the row
 * the tab would have. The one exception is a day too big to read whole (the
 * same `truncated` read the tab itself refuses to fold) — that day's raw rows go
 * anyway, because the retention period is a promise and the chart is not.
 *
 * Run in bounded steps, never one long request (§12): each call walks maps from
 * a cursor until `deadline`, and hands back where to resume.
 */

/** Maps offered to one step. Most answer "nothing expired" in one query. */
const MAPS_PER_PAGE = 25;

/** The first day still kept: sessions on any day before it have expired. */
export function retentionCutoff(plan: PlanId, now: Date): string {
  return addDays(utcDay(now), -SESSION_LIMITS[plan].retentionDays);
}

export type RetentionStep = {
  /** Where the next step starts, or null when every map has been walked. */
  cursor: string | null;
  /** Map-days whose raw sessions were deleted by this step. */
  purgedDays: number;
};

export async function purgeExpiredSessions(input: {
  cursor: string | null;
  deadline: number;
  now: Date;
}): Promise<RetentionStep> {
  const { maps, next } = await listMapsForRetention(input.cursor, MAPS_PER_PAGE);
  let purgedDays = 0;
  // Resume points: the cursor *before* the map being worked on, so a step that
  // runs out of time mid-map hands that same map to the next one.
  let resumeFrom = input.cursor;

  for (const map of maps) {
    const cutoff = retentionCutoff(await getUserPlan(map.ownerId), input.now);

    for (;;) {
      // Checked only after some work, so every step makes progress.
      if (purgedDays > 0 && Date.now() > input.deadline) {
        return { cursor: resumeFrom, purgedDays };
      }

      const day = await oldestExpiredDay(map.id, cutoff);
      if (!day) break;

      await expireDay(map.id, day);
      purgedDays += 1;
    }

    resumeFrom = map.id;
  }

  return { cursor: next, purgedDays };
}

async function expireDay(mapId: string, day: string): Promise<void> {
  if (!(await hasDailyRollup(mapId, day))) {
    const { sessions, truncated } = await readDaySessions(mapId, day);
    const fold = truncated ? undefined : foldByDay(sessions).get(day);

    if (fold) {
      await storeDailyRollup(mapId, {
        day,
        sessions: fold.sessions,
        views: fold.views,
        interactions: fold.interactions,
        totals: foldToTotals(fold),
      });
    }
  }

  await deleteDaySessions(mapId, day);
}
