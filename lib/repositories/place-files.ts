import "server-only";

import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isNotFound } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";

/**
 * The storage files a location names, and removing them once it is gone.
 *
 * **Why this exists.** Deleting a location, a group's contents or a map used to
 * leave every photo and logo it named in storage, and said so in a comment. That
 * is not only waste: create a location, upload eight 5MB photos, delete it,
 * repeat — and a free account grows storage without limit, which no plan ceiling
 * could see because every one of them counts rows, not files.
 *
 * Its own module because `files.repository.ts` imports `places.repository.ts`,
 * and the deletes that need this live there.
 *
 * Account deletion does its own version in `account-deletion.repository.ts`,
 * where a file that will not delete must stop the step. Here it must not: the
 * rows are already gone, and a file left behind is wasted storage rather than a
 * broken map.
 */

type PlaceFilesRow = Models.Row & {
  photoIds?: string[] | null;
  photoId?: string | null;
  logoId?: string | null;
};

const PAGE = 100;

/** Far past any plan's places-per-map; a guard on the loop, not a limit. */
const MAX_PAGES = 40;

/** Deletes in flight at once. */
const CONCURRENCY = 8;

/**
 * Every file named by the locations matching `queries`, paged.
 *
 * Call it **before** deleting the rows — afterwards there is nothing left to
 * read the ids from.
 */
export async function listPlaceFileIds(queries: string[]): Promise<string[]> {
  const ids = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { rows }: { rows: PlaceFilesRow[] } = await admin.tablesDB.listRows<PlaceFilesRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      queries: [
        ...queries,
        Query.select(["$id", "photoIds", "photoId", "logoId"]),
        Query.orderAsc("$id"),
        Query.limit(PAGE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });

    for (const row of rows) {
      for (const id of row.photoIds ?? []) if (id) ids.add(id);
      if (row.photoId) ids.add(row.photoId);
      if (row.logoId) ids.add(row.logoId);
    }

    if (rows.length < PAGE) break;
    cursor = rows[rows.length - 1].$id;
  }

  return [...ids];
}

/**
 * Delete these files, best effort, within `budgetMs`.
 *
 * **Never throws.** It runs after the rows are gone, so there is nothing left to
 * roll back and nothing the customer can retry. A file already gone is fine. The
 * budget keeps a map with thousands of photos inside the host's 30-second cap
 * (CLAUDE.md §12); what does not fit is logged, as a leak the operator can see.
 */
export async function removeStorageFiles(
  fileIds: readonly string[],
  budgetMs = 10_000,
): Promise<void> {
  const queue = fileIds.filter(Boolean);
  const deadline = Date.now() + budgetMs;
  let failed = 0;

  const worker = async () => {
    for (let fileId = queue.shift(); fileId; fileId = queue.shift()) {
      if (Date.now() > deadline) {
        queue.unshift(fileId);
        return;
      }

      try {
        await admin.storage.deleteFile({ bucketId: env.storageId, fileId });
      } catch (error) {
        if (!isNotFound(error)) failed += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  if (failed > 0 || queue.length > 0) {
    console.error(
      `Storage files left behind after a delete: ${String(failed)} failed, ${String(queue.length)} out of time.`,
    );
  }
}
