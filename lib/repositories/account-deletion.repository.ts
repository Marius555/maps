import "server-only";

import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isNotFound, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type { RepoContext } from "./context";
import { deleteMap, getMap, listMaps } from "./maps.repository";
import { deletePlacesById } from "./places.repository";

/**
 * Everything an account owns, removed, for `lib/account-deletion/step.ts`.
 *
 * **Small pieces, because the host has a 30-second ceiling on a request**
 * (CLAUDE.md §12) and an account can own 15 maps of 3,000 locations, each with
 * photos, and a photo is one storage request to delete. So nothing here tries
 * to do a whole account; each call does a bounded amount, and the step decides
 * how many to make before it hands back.
 *
 * **Files before the rows that point at them.** A location row is the only
 * record of which files are its photos and logo. Deleting the row first would
 * leave files nobody can find, and they are public-read (a photo has to load on
 * a customer's site), so a leftover file is somebody's photo still online after
 * they deleted the account.
 *
 * **What `deleteMap` does not remove, this does**: the map's groups and its
 * analytics rows (`mapSessions`, `mapDaily`). Single-map deletion leaves those
 * behind today, which is a known gap noted in docs/notes/settings.md. Account
 * deletion cannot leave them, because nobody would be left to own them.
 */

/** Places per page. One `listRows`, then files, then one `deleteRows`. */
const PLACE_PAGE = 100;

/** Storage deletes in flight at once. Enough to finish a page well inside a step. */
const FILE_CONCURRENCY = 8;

export async function listOwnedMapIds(ctx: RepoContext): Promise<string[]> {
  return (await listMaps(ctx)).map((map) => map.id);
}

type PlaceFilesRow = Models.Row & {
  photoIds?: string[] | null;
  photoId?: string | null;
  logoId?: string | null;
};

/** The next page of a map's locations, and every file those locations name. */
export async function takePlaceFiles(
  ctx: RepoContext,
  mapId: string,
): Promise<{ placeIds: string[]; fileIds: string[] }> {
  await getMap(ctx, mapId);

  try {
    const { rows } = await admin.tablesDB.listRows<PlaceFilesRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      queries: [
        Query.equal("mapId", mapId),
        Query.select(["$id", "photoIds", "photoId", "logoId"]),
        Query.limit(PLACE_PAGE),
      ],
    });

    const fileIds = new Set<string>();

    for (const row of rows) {
      for (const id of row.photoIds ?? []) if (id) fileIds.add(id);
      if (row.photoId) fileIds.add(row.photoId);
      if (row.logoId) fileIds.add(row.logoId);
    }

    return { placeIds: rows.map((row) => row.$id), fileIds: [...fileIds] };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Removes storage files. A file already gone is fine: a step that died halfway
 * is retried, and it will ask for the same files again.
 *
 * Any other failure throws, so the location rows naming the file are not
 * deleted and the next step can try again. Best effort here would mean a
 * photo left online with nothing pointing at it.
 */
export async function deleteFiles(fileIds: readonly string[]): Promise<void> {
  const queue = [...fileIds];

  const worker = async () => {
    for (let fileId = queue.shift(); fileId; fileId = queue.shift()) {
      try {
        await admin.storage.deleteFile({ bucketId: env.storageId, fileId });
      } catch (error) {
        if (!isNotFound(error)) throw toRepositoryError(error);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(FILE_CONCURRENCY, queue.length) }, worker));
}

export async function deletePlaces(
  ctx: RepoContext,
  mapId: string,
  placeIds: string[],
): Promise<void> {
  if (placeIds.length > 0) await deletePlacesById(ctx, mapId, placeIds);
}

/**
 * A map with no locations left: its groups and analytics, then the map itself.
 *
 * Leftovers first, `deleteMap` last. Once the map row is gone the next step
 * cannot find this map to finish it, so anything still keyed to it would be
 * orphaned for good.
 */
export async function deleteEmptiedMap(ctx: RepoContext, mapId: string): Promise<void> {
  await getMap(ctx, mapId);

  try {
    for (const tableId of [TABLES.groups, TABLES.mapSessions, TABLES.mapDaily]) {
      await admin.tablesDB.deleteRows({
        databaseId: env.databaseId,
        tableId,
        queries: [Query.equal("mapId", mapId)],
      });
    }
  } catch (error) {
    throw toRepositoryError(error);
  }

  await deleteMap(ctx, mapId);
}

/**
 * The rows keyed to the account rather than to a map: its card design, its
 * lookup meter, its subscription record. The last thing before the login goes.
 */
export async function deleteAccountRows(ctx: RepoContext): Promise<void> {
  try {
    for (const tableId of [TABLES.cardDesigns, TABLES.usage, TABLES.subscriptions]) {
      await admin.tablesDB.deleteRows({
        databaseId: env.databaseId,
        tableId,
        queries: [Query.equal("userId", ctx.userId)],
      });
    }
  } catch (error) {
    throw toRepositoryError(error);
  }
}
