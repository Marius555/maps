import "server-only";

import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/** Cross-account — see the head of `./users.ts`. */

type TableId = (typeof TABLES)[keyof typeof TABLES];

/** One row over the wire; `total` still reports the real count. */
async function countRows(tableId: TableId, queries: string[] = []): Promise<number> {
  const result = await admin.tablesDB.listRows({
    databaseId: env.databaseId,
    tableId,
    queries: [...queries, Query.select(["$id"]), Query.limit(1)],
    total: true,
  });

  return result.total;
}

export type ContentTotals = {
  maps: number;
  published: number;
  places: number;
  shapes: number;
  sheetLinks: number;
};

export async function readContentTotals(): Promise<ContentTotals> {
  const [maps, published, places, shapes, sheetLinks] = await Promise.all([
    countRows(TABLES.maps),
    countRows(TABLES.maps, [Query.isNotNull("publishedAt")]),
    countRows(TABLES.places),
    countRows(TABLES.shapes),
    countRows(TABLES.sheetLinks),
  ]);

  return { maps, published, places, shapes, sheetLinks };
}

export type AdminMap = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  publishedAt: string | null;
};

type MapRow = Models.Row & { userId: string; name: string; publishedAt?: string | null };

/** Every map's identifying columns — never the JSON blobs — newest first. */
export async function listAllMaps(cap = 5_000): Promise<AdminMap[]> {
  const maps: AdminMap[] = [];
  let cursor: string | undefined;

  while (maps.length < cap) {
    const result = await admin.tablesDB.listRows<MapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      queries: [
        Query.select(["$id", "$createdAt", "userId", "name", "publishedAt"]),
        Query.orderDesc("$createdAt"),
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });

    for (const row of result.rows) {
      maps.push({
        id: row.$id,
        userId: row.userId,
        name: row.name,
        createdAt: row.$createdAt,
        publishedAt: row.publishedAt ?? null,
      });
    }

    if (result.rows.length < 500) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }

  return maps;
}

/**
 * How many locations each of `mapIds` holds — one count query per map, ten at
 * a time, so the caller bounds the cost by how many ids it passes.
 */
export async function countPlacesByMap(mapIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (let start = 0; start < mapIds.length; start += 10) {
    const batch = mapIds.slice(start, start + 10);
    const totals = await Promise.all(
      batch.map((mapId) => countRows(TABLES.places, [Query.equal("mapId", mapId)])),
    );

    batch.forEach((mapId, index) => counts.set(mapId, totals[index]));
  }

  return counts;
}
