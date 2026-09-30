import "server-only";

import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/**
 * Cross-account — see the head of `./users.ts`. Published-map visitor sessions
 * across every map.
 *
 * `mapDaily` cannot answer this: it is rolled up lazily, only when an owner
 * opens their Analytics tab, so it is missing every map whose owner never
 * looks. `mapSessions` is complete, so it is counted directly — one `total`
 * query per day, which a 90-day range makes 90 small parallel reads.
 */

async function countDay(day: string): Promise<number> {
  const result = await admin.tablesDB.listRows({
    databaseId: env.databaseId,
    tableId: TABLES.mapSessions,
    queries: [Query.equal("day", day), Query.select(["$id"]), Query.limit(1)],
    total: true,
  });

  return result.total;
}

export async function countSessionsByDay(days: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (let start = 0; start < days.length; start += 15) {
    const batch = days.slice(start, start + 15);
    const totals = await Promise.all(batch.map(countDay));

    batch.forEach((day, index) => counts.set(day, totals[index]));
  }

  return counts;
}

export type SessionSample = {
  mapId: string;
  country: string | null;
  host: string | null;
  device: string | null;
};

type SessionRow = Models.Row & {
  mapId: string;
  country?: string | null;
  host?: string | null;
  device?: string | null;
};

/**
 * Sessions since `fromDay`, identifying columns only, for the
 * country, site and device breakdowns. A sample, capped: the per-day chart
 * above is the exact count.
 */
export async function sampleSessions(
  fromDay: string,
  cap = 3_000,
): Promise<{ sessions: SessionSample[]; truncated: boolean }> {
  const sessions: SessionSample[] = [];
  let cursor: string | undefined;

  while (sessions.length < cap) {
    const result = await admin.tablesDB.listRows<SessionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.mapSessions,
      queries: [
        Query.greaterThanEqual("day", fromDay),
        Query.select(["$id", "mapId", "country", "host", "device"]),
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });

    for (const row of result.rows) {
      sessions.push({
        mapId: row.mapId,
        country: row.country ?? null,
        host: row.host ?? null,
        device: row.device ?? null,
      });
    }

    if (result.rows.length < 500) return { sessions, truncated: false };
    cursor = result.rows[result.rows.length - 1].$id;
  }

  return { sessions: sessions.slice(0, cap), truncated: true };
}
