import "server-only";

import type { Delta } from "@/lib/analytics/view";
import { requireAdmin } from "@/lib/admin/auth/guard";
import { listApiCalls } from "@/lib/repositories/api-calls.repository";
import { listEmailLog } from "@/lib/repositories/email-log.repository";
import { listAllMaps, readContentTotals } from "@/lib/repositories/admin/content";
import { countSessionsByDay } from "@/lib/repositories/admin/sessions";
import { listAllSubscriptions } from "@/lib/repositories/admin/subscriptions";
import { listPooledLookups } from "@/lib/repositories/admin/usage";
import { listAllUsers } from "@/lib/repositories/admin/users";
import { BACKGROUND_RESERVE, DAILY_LOOKUP_BUDGET } from "@/lib/repositories/usage.repository";
import type { AdminRange } from "@/lib/validation/admin.schema";
import {
  countByDay,
  deltaOf,
  periodOf,
  seriesOf,
  sum,
  toDay,
  withinDays,
  type DayPoint,
} from "./period";
import { estimateMrr, isPaying } from "./revenue";

/** A figure for the period, its days, and the same days of the period before. */
export type Kpi = { delta: Delta; series: DayPoint[]; previous: DayPoint[] };

export type OverviewMetrics = {
  signups: Kpi;
  sessions: Kpi;
  apiCalls: Kpi;
  emails: Kpi;
  maps: Kpi;
  totalUsers: number;
  active7: number;
  paying: number;
  mrr: number;
  mapCount: number;
  published: number;
  places: number;
  poolToday: number;
  poolBudget: number;
  /** Where background work stands aside, in lookups. */
  poolReserve: number;
  recentSignups: { id: string; name: string; email: string; createdAt: string; verified: boolean }[];
};

/**
 * The front page: one read of each source, shaped into the "right now" strip and
 * the growth tabs. Its own reads rather than the other loaders', because those
 * would read the user list three times over.
 */
export async function loadOverviewMetrics(range: AdminRange): Promise<OverviewMetrics> {
  await requireAdmin();

  const now = new Date();
  const period = periodOf(range, now);

  const [{ users, total }, subscriptions, calls, emails, sessions, maps, totals, pooled] =
    await Promise.all([
      listAllUsers(),
      listAllSubscriptions(),
      listApiCalls(period.previousFromDay, toDay(now)),
      listEmailLog(period.previousFromDay),
      countSessionsByDay([...period.previousDays, ...period.days]),
      listAllMaps(),
      readContentTotals(),
      listPooledLookups(toDay(now)),
    ]);

  const created = users.map((user) => user.createdAt);
  const signupSeries = countByDay(created, period.days);

  const callsByDay = new Map<string, number>();
  for (const row of calls) {
    callsByDay.set(row.day, (callsByDay.get(row.day) ?? 0) + row.ok + row.failed);
  }

  const sentAt = emails.rows.map((row) => row.sentAt);
  const emailSeries = countByDay(sentAt, period.days);
  const sessionSeries = seriesOf(sessions, period.days);
  const callSeries = seriesOf(callsByDay, period.days);
  const mapCreated = maps.map((map) => map.createdAt);
  const mapSeries = countByDay(mapCreated, period.days);

  const kpi = (series: DayPoint[], previous: DayPoint[]): Kpi => ({
    delta: deltaOf(sum(series), sum(previous)),
    series,
    previous,
  });

  return {
    signups: kpi(signupSeries, countByDay(created, period.previousDays)),
    sessions: kpi(sessionSeries, seriesOf(sessions, period.previousDays)),
    apiCalls: kpi(callSeries, seriesOf(callsByDay, period.previousDays)),
    emails: kpi(emailSeries, countByDay(sentAt, period.previousDays)),
    maps: kpi(mapSeries, countByDay(mapCreated, period.previousDays)),
    totalUsers: total,
    active7: users.filter((user) => withinDays(user.accessedAt, 7, now)).length,
    paying: subscriptions.filter((sub) => isPaying(sub, now)).length,
    mrr: estimateMrr(subscriptions, now),
    mapCount: totals.maps,
    published: totals.published,
    places: totals.places,
    poolToday: pooled.find((row) => row.period === toDay(now))?.lookups ?? 0,
    poolBudget: DAILY_LOOKUP_BUDGET,
    poolReserve: Math.floor(DAILY_LOOKUP_BUDGET * BACKGROUND_RESERVE),
    recentSignups: users.slice(0, 8).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      verified: user.verified,
    })),
  };
}
