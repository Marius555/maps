import "server-only";

import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type { RepoContext } from "./context";
import { latestOf, type TableActivity } from "./map-activity";
import { listMaps } from "./maps.repository";
import type { AppMap, MapSummary } from "./types";

/**
 * The caller's maps, each with what the maps list says about it.
 *
 * One request per table per map: newest row first, one row, with the total. That
 * single row answers two questions at once — how many there are, and when the
 * newest of them last changed — which is the same request `countPlaces` already
 * made, asked in a more useful order.
 *
 * Ownership is `listMaps(ctx)`: it only ever returns the caller's own maps, so
 * the per-map reads below cannot be pointed at anyone else's. That is also why
 * this does not call `getMap` per map the way the single-map readers do — fifteen
 * extra requests to re-prove what the list query already proved.
 */
export async function listMapSummaries(
  ctx: RepoContext,
): Promise<{ map: AppMap; summary: MapSummary }[]> {
  const maps = await listMaps(ctx);

  try {
    return await Promise.all(
      maps.map(async (map) => {
        const [places, shapes, groups] = await Promise.all([
          activity(TABLES.places, map.id),
          activity(TABLES.shapes, map.id),
          activity(TABLES.groups, map.id),
        ]);

        return {
          map,
          summary: {
            placeCount: places.count,
            shapeCount: shapes.count,
            lastEditedAt: latestOf(map.updatedAt, places.last, shapes.last, groups.last),
          },
        };
      }),
    );
  } catch (error) {
    throw toRepositoryError(error);
  }
}

async function activity(tableId: string, mapId: string): Promise<TableActivity> {
  const result = await admin.tablesDB.listRows<Models.Row>({
    databaseId: env.databaseId,
    tableId,
    queries: [
      Query.equal("mapId", mapId),
      Query.orderDesc("$updatedAt"),
      Query.limit(1),
    ],
    total: true,
  });

  return { count: result.total, last: result.rows[0]?.$updatedAt ?? null };
}
