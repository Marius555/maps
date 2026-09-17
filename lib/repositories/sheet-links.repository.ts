import "server-only";

import { ID, Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type {
  SheetLink,
  SheetSyncReport,
  SheetSyncStatus,
} from "@/lib/sheet-sync/types";
import type { SaveSheetLinkInput } from "@/lib/validation/sheet-link.schema";
import type { RepoContext } from "./context";
import { toSheetLink } from "./mappers";
import { getMap, ownerPermissions } from "./maps.repository";
import { assertPlanFeature } from "./plan-limits";
import type { SheetLinkRow } from "./types";

/**
 * A map's link to a Google Sheet. docs/notes/sheet-sync.md.
 *
 * Two kinds of caller, and the split is on purpose. The dashboard's own reads
 * and writes take a `RepoContext` and prove ownership through `getMap`, like
 * every other repository. The sync's bookkeeping — the lock and the result —
 * takes a link id, because the daily job runs with no session at all; the link
 * it is handed came from `listDueSheetLinks`, and every write to a map it makes
 * afterwards goes through `repoContext(link.userId)` and the normal checks.
 */

async function findRow(mapId: string): Promise<SheetLinkRow | null> {
  const result = await admin.tablesDB.listRows<SheetLinkRow>({
    databaseId: env.databaseId,
    tableId: TABLES.sheetLinks,
    queries: [Query.equal("mapId", mapId), Query.limit(1)],
  });

  return result.rows[0] ?? null;
}

export async function getSheetLink(
  ctx: RepoContext,
  mapId: string,
): Promise<SheetLink | null> {
  await getMap(ctx, mapId);

  try {
    const row = await findRow(mapId);
    return row ? toSheetLink(row) : null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Link a map to a sheet, or re-link it to a different one.
 *
 * One link per map, so importing a second sheet with sync on replaces the first
 * rather than adding a second source of truth — two sheets each insisting on
 * the map's contents would remove each other's rows every night.
 *
 * The plan is checked here as well as on every sync: this is the moment an
 * account starts committing to daily spend.
 */
export async function saveSheetLink(
  ctx: RepoContext,
  mapId: string,
  input: SaveSheetLinkInput,
): Promise<SheetLink> {
  await getMap(ctx, mapId);
  await assertPlanFeature(ctx.userId, "sheetSync");

  const data = {
    sheetId: input.sheetId,
    gid: input.gid ?? null,
    published: input.published,
    mapping: JSON.stringify(input.mapping),
    headerRowIndex: input.headerRowIndex,
    autoSync: input.autoSync,
    // A fresh link has not been synced by the job yet; the import that created
    // it *is* its first sync, so it counts from now.
    lastSyncedAt: new Date().toISOString(),
    lastStatus: "ok",
    lastReport: null,
    failedLookups: null,
    syncingUntil: null,
  };

  try {
    const existing = await findRow(mapId);

    const row = existing
      ? await admin.tablesDB.updateRow<SheetLinkRow>({
          databaseId: env.databaseId,
          tableId: TABLES.sheetLinks,
          rowId: existing.$id,
          data,
        })
      : await admin.tablesDB.createRow<SheetLinkRow>({
          databaseId: env.databaseId,
          tableId: TABLES.sheetLinks,
          rowId: ID.unique(),
          data: { userId: ctx.userId, mapId, ...data },
          permissions: ownerPermissions(ctx.userId),
        });

    return toSheetLink(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** The daily switch. Returns null when the map has no link to switch. */
export async function setSheetAutoSync(
  ctx: RepoContext,
  mapId: string,
  autoSync: boolean,
): Promise<SheetLink | null> {
  await getMap(ctx, mapId);

  try {
    const existing = await findRow(mapId);
    if (!existing) return null;

    const row = await admin.tablesDB.updateRow<SheetLinkRow>({
      databaseId: env.databaseId,
      tableId: TABLES.sheetLinks,
      rowId: existing.$id,
      data: { autoSync },
    });

    return toSheetLink(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Unlink. The locations stay exactly as they are, `sourceKey` included — a key
 * with no link behind it is inert, and a later re-link to the same sheet picks
 * the same locations back up instead of duplicating them.
 */
export async function deleteSheetLink(ctx: RepoContext, mapId: string): Promise<void> {
  await getMap(ctx, mapId);

  try {
    const existing = await findRow(mapId);
    if (!existing) return;

    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.sheetLinks,
      rowId: existing.$id,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/* ------------------------------------------------------------------ *
 * The sync's own bookkeeping. No RepoContext — see the head of the file.
 * ------------------------------------------------------------------ */

/**
 * A map's link, for the daily job — which has no session and so no context.
 * Whatever it then does to the map goes through `repoContext(link.userId)`.
 */
export async function findSheetLinkForMap(mapId: string): Promise<SheetLink | null> {
  try {
    const row = await findRow(mapId);
    return row ? toSheetLink(row) : null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Links the daily job should visit, least recently synced first.
 *
 * Oldest first is what makes a time-boxed job fair: whatever it does not reach
 * today is at the front tomorrow.
 */
export async function listDueSheetLinks(limit: number): Promise<SheetLink[]> {
  try {
    const result = await admin.tablesDB.listRows<SheetLinkRow>({
      databaseId: env.databaseId,
      tableId: TABLES.sheetLinks,
      queries: [
        Query.equal("autoSync", true),
        Query.orderAsc("lastSyncedAt"),
        Query.limit(limit),
      ],
    });

    return result.rows.map(toSheetLink);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Claim a link for one sync, or report that another sync holds it.
 *
 * A soft lock — read, then write — because Appwrite has no conditional update.
 * The window it leaves is two syncs starting in the same few milliseconds, and
 * the worst that does is write the same rows twice; what it closes is the
 * common case, a second press of Sync now or the daily job arriving mid-sync.
 */
export async function claimSheetLink(linkId: string, holdMs: number): Promise<boolean> {
  try {
    const row = await admin.tablesDB.getRow<SheetLinkRow>({
      databaseId: env.databaseId,
      tableId: TABLES.sheetLinks,
      rowId: linkId,
    });

    if (row.syncingUntil && Date.parse(row.syncingUntil) > Date.now()) return false;

    await admin.tablesDB.updateRow<SheetLinkRow>({
      databaseId: env.databaseId,
      tableId: TABLES.sheetLinks,
      rowId: linkId,
      data: { syncingUntil: new Date(Date.now() + holdMs).toISOString() },
    });

    return true;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** Record how a sync step went, and let go of the link. */
export async function recordSheetSync(
  linkId: string,
  status: SheetSyncStatus,
  report: SheetSyncReport,
  failedLookups: SheetLink["failedLookups"],
): Promise<SheetLink> {
  try {
    const row = await admin.tablesDB.updateRow<SheetLinkRow>({
      databaseId: env.databaseId,
      tableId: TABLES.sheetLinks,
      rowId: linkId,
      data: {
        lastSyncedAt: new Date().toISOString(),
        lastStatus: status,
        lastReport: JSON.stringify(report),
        failedLookups:
          Object.keys(failedLookups).length > 0 ? JSON.stringify(failedLookups) : null,
        syncingUntil: null,
      },
    });

    return toSheetLink(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}
