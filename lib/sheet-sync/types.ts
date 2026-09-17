import type { ColumnMapping } from "@/lib/import/column-mapping";

/**
 * A map kept in step with a Google Sheet, and how its last sync went.
 *
 * Pure types, safe on both sides: the Locations page reads these to draw the
 * sync button, and the runner writes them. docs/notes/sheet-sync.md.
 */

/** Matches SHEET_SYNC_STATUSES in scripts/appwrite-schema.mjs. */
export const SHEET_SYNC_STATUSES = [
  "ok",
  "partial",
  "failed",
  "needs_confirmation",
] as const;

/**
 * - `ok` — the map matches the sheet, give or take the rows listed as skipped.
 * - `partial` — work is left over (the time ran out, or the plan is full). The
 *   next sync picks it up with no special path, because it recomputes the
 *   difference from scratch.
 * - `failed` — nothing was written: the sheet could not be read, or a column the
 *   link depends on is gone.
 * - `needs_confirmation` — nothing was written because the sync would remove
 *   more locations than a sheet edit plausibly means to.
 */
export type SheetSyncStatus = (typeof SHEET_SYNC_STATUSES)[number];

/** A row the sync could not turn into a location, with the sheet row number. */
export type SheetSyncSkip = {
  /** 1-based data row, the number a person sees beside it in Google Sheets. */
  row: number;
  name: string;
  reason: string;
};

export type SheetSyncReport = {
  added: number;
  updated: number;
  removed: number;
  /** The first few skipped rows, named. `skippedTotal` is the whole count. */
  skipped: SheetSyncSkip[];
  skippedTotal: number;
  /** Set on `needs_confirmation`: how many locations the sync wanted to remove. */
  pendingRemovals?: number;
  /** How many sheet-linked locations there were when it asked. */
  linkedCount?: number;
  /** True when the sync changed something and the live map was republished. */
  republished: boolean;
  /** The sentence to show for `failed` and `partial`. */
  message?: string;
};

/** The link, as the dashboard sees it. */
export type SheetLink = {
  id: string;
  userId: string;
  mapId: string;
  sheetId: string;
  gid: string | null;
  published: boolean;
  mapping: ColumnMapping;
  /** Null when the sheet had no header row and the import named the columns. */
  headerRowIndex: number | null;
  autoSync: boolean;
  lastSyncedAt: string | null;
  lastStatus: SheetSyncStatus | null;
  lastReport: SheetSyncReport | null;
  /**
   * Addresses the geocoder recently could not place — address hash → when.
   * Server bookkeeping; never sent to the browser.
   */
  failedLookups: Record<string, { at: string; status: "low" | "failed" }>;
  syncingUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The link as the browser gets it — the owner and the lookup cache stay on the server. */
export type SheetLinkView = Omit<SheetLink, "userId" | "failedLookups">;

export function toSheetLinkView(link: SheetLink): SheetLinkView {
  return {
    id: link.id,
    mapId: link.mapId,
    sheetId: link.sheetId,
    gid: link.gid,
    published: link.published,
    mapping: link.mapping,
    headerRowIndex: link.headerRowIndex,
    autoSync: link.autoSync,
    lastSyncedAt: link.lastSyncedAt,
    lastStatus: link.lastStatus,
    lastReport: link.lastReport,
    syncingUntil: link.syncingUntil,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

/** How many skipped rows a report names before it only counts. */
export const MAX_REPORTED_SKIPS = 20;

/** The sheet's own address, for the Open sheet link. */
export function sheetUrl(link: Pick<SheetLink, "sheetId" | "gid" | "published">): string {
  const base = link.published
    ? `https://docs.google.com/spreadsheets/d/e/${link.sheetId}/pubhtml`
    : `https://docs.google.com/spreadsheets/d/${link.sheetId}/edit`;

  return link.gid ? `${base}#gid=${link.gid}` : base;
}
