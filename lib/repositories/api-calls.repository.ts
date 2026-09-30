import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/**
 * Upstream requests per day, provider and kind — the operator console's record
 * of what the geocoder and router were actually asked.
 *
 * Written only by `lib/api-usage/counter.ts`, which batches. Read-add-write,
 * because Appwrite has no atomic increment; a race loses a count rather than
 * adding one, the direction `usage.repository.ts` explains is the survivable
 * one. Rows carry no permission: nothing but the admin client touches them.
 */

export type ApiProvider = "geoapify" | "photon" | "osrm";
export type ApiKind = "geocode" | "reverse" | "route" | "nearest";

export type ApiCallCount = {
  day: string;
  provider: ApiProvider;
  kind: ApiKind;
  ok: number;
  failed: number;
};

type ApiCallRow = Models.Row & {
  day: string;
  provider: string;
  kind: string;
  ok?: number | null;
  failed?: number | null;
};

/** Add to one (day, provider, kind) row, creating it if it is the day's first. */
export async function addApiCalls(count: ApiCallCount): Promise<void> {
  const existing = await admin.tablesDB.listRows<ApiCallRow>({
    databaseId: env.databaseId,
    tableId: TABLES.apiCalls,
    queries: [
      Query.equal("day", count.day),
      Query.equal("provider", count.provider),
      Query.equal("kind", count.kind),
      Query.limit(1),
    ],
  });

  const row = existing.rows[0];

  if (row) {
    await admin.tablesDB.updateRow({
      databaseId: env.databaseId,
      tableId: TABLES.apiCalls,
      rowId: row.$id,
      data: {
        ok: (row.ok ?? 0) + count.ok,
        failed: (row.failed ?? 0) + count.failed,
      },
    });

    return;
  }

  await admin.tablesDB.createRow({
    databaseId: env.databaseId,
    tableId: TABLES.apiCalls,
    rowId: ID.unique(),
    data: { ...count },
  });
}

/** Every row from `fromDay` to `toDay` inclusive, both `YYYY-MM-DD`. */
export async function listApiCalls(fromDay: string, toDay: string): Promise<ApiCallCount[]> {
  const rows: ApiCallCount[] = [];
  let cursor: string | undefined;

  // At most 90 days × 3 providers × 4 kinds = 1,080 rows; paged anyway.
  for (let page = 0; page < 20; page += 1) {
    const result = await admin.tablesDB.listRows<ApiCallRow>({
      databaseId: env.databaseId,
      tableId: TABLES.apiCalls,
      queries: [
        Query.greaterThanEqual("day", fromDay),
        Query.lessThanEqual("day", toDay),
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });

    for (const row of result.rows) {
      rows.push({
        day: row.day,
        provider: row.provider as ApiProvider,
        kind: row.kind as ApiKind,
        ok: row.ok ?? 0,
        failed: row.failed ?? 0,
      });
    }

    if (result.rows.length < 500) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }

  return rows;
}
