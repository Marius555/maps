/**
 * One step of deleting an account: as much as fits in a time budget, in an
 * order that is safe to stop at any point and start again from.
 *
 * **Why steps.** The host cuts every request off at 30 seconds (CLAUDE.md §12),
 * and a full Pro account is fifteen maps of three thousand locations, each with
 * photos, each photo one storage request. So the dialog calls this route again
 * and again until it says `done`, the pattern the sheet sync set
 * (`docs/notes/sheet-sync.md`).
 *
 * **Why this order.** Every stage re-reads what is left rather than remembering
 * a cursor, so a step that dies halfway (a timeout, a closed tab) leaves
 * nothing that the next step cannot find:
 *
 * 1. For each map, a page of its locations: first their files, then the rows.
 *    The row is the only record of which files are its, so it goes second.
 * 2. When a map has no locations left: its groups, its analytics, then the map
 *    itself (snapshots, shapes, sheet link, row) — see `deleteEmptiedMap`.
 * 3. When no maps are left: the rows keyed to the account (card design, lookup
 *    meter, subscription record).
 * 4. Last, the login. After this nobody is left to be signed in as, so it runs
 *    only once everything else has gone.
 *
 * The subscription was cancelled before the first step (`POST
 * /api/account/deletion`), so no charge can land while this runs.
 *
 * Pure orchestration over a `DeletionStore`, so the order and the budget are
 * tested without Appwrite (`step.test.ts`).
 */

export type DeletionStore = {
  listMapIds(): Promise<string[]>;
  /** The next page of one map's locations and the files they name. */
  takePlaceFiles(mapId: string): Promise<{ placeIds: string[]; fileIds: string[] }>;
  deleteFiles(fileIds: readonly string[]): Promise<void>;
  deletePlaces(mapId: string, placeIds: string[]): Promise<void>;
  /** A map with no locations left, and everything else keyed to it. */
  deleteEmptiedMap(mapId: string): Promise<void>;
  deleteAccountRows(): Promise<void>;
  deleteUser(): Promise<void>;
};

export type DeletionProgress = {
  done: boolean;
  /** Maps still to delete, for the dialog's "3 of 15 left". */
  mapsLeft: number;
};

/**
 * Work time per step. Half the host's ceiling, because the budget is checked
 * *between* operations: the last one started may run past it, and a single
 * `deleteMap` with a long snapshot history is the slowest thing here.
 */
export const DELETION_STEP_MS = 15_000;

export async function runDeletionStep(
  store: DeletionStore,
  { budgetMs = DELETION_STEP_MS, now = Date.now }: { budgetMs?: number; now?: () => number } = {},
): Promise<DeletionProgress> {
  const deadline = now() + budgetMs;
  const outOfTime = () => now() >= deadline;

  const maps = await store.listMapIds();

  for (const [index, mapId] of maps.entries()) {
    const mapsLeft = maps.length - index;

    for (;;) {
      if (outOfTime()) return { done: false, mapsLeft };

      const { placeIds, fileIds } = await store.takePlaceFiles(mapId);
      if (placeIds.length === 0) break;

      await store.deleteFiles(fileIds);
      await store.deletePlaces(mapId, placeIds);
    }

    if (outOfTime()) return { done: false, mapsLeft };

    await store.deleteEmptiedMap(mapId);
  }

  if (outOfTime()) return { done: false, mapsLeft: 0 };

  await store.deleteAccountRows();
  await store.deleteUser();

  return { done: true, mapsLeft: 0 };
}
