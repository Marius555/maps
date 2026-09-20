import "server-only";

import { env } from "@/lib/env";
import type { MapSnapshot } from "@/packages/shared/snapshot";

import * as appwrite from "./appwrite-store";
import * as r2 from "./r2-store";

/**
 * Where a published snapshot goes, and how the embed finds it.
 *
 * Two files are written per publish, because the two requirements pull apart:
 *
 * - CLAUDE.md §7 wants snapshots immutable and versioned, so a half-written file
 *   can never break a live customer site.
 * - CLAUDE.md §2 forbids a metered request in the visitor path, so the embed
 *   cannot ask us "which snapshot is current?" — its URL must be stable across
 *   republishes, or every customer would have to re-paste their snippet.
 *
 * So: an immutable archive under a fresh key every time, and one live file at a
 * fixed key that the embed reads. The archive is written first and never touched
 * again, which is what makes a failed publish recoverable.
 *
 * **Production is R2** (`./r2-store.ts`), chosen by `SNAPSHOT_PUBLIC_URL`. The
 * Appwrite store (`./appwrite-store.ts`) is what an unset variable means, and it
 * cannot serve a customer: Appwrite Storage answers 403 `general_unknown_origin`
 * to any Origin not registered as a Web platform, and the embed's `fetch` always
 * sends one. The publish preview never showed it — its `srcdoc` frame inherits
 * the dashboard's own, registered, origin. Test from a foreign origin.
 */

export type UploadedSnapshot = {
  /** Stable across republishes. This is what the embed snippet points at. */
  liveUrl: string;
  /** The immutable copy written by this publish. */
  archiveUrl: string;
};

export function uploadSnapshot(snapshot: MapSnapshot): Promise<UploadedSnapshot> {
  return onR2() ? r2.uploadSnapshot(snapshot) : appwrite.uploadSnapshot(snapshot);
}

/**
 * Removes a map's snapshots. Called when the map itself is deleted, before its
 * rows — so on R2 a failure here throws and stops the delete, rather than leave
 * a world-readable copy of the customer's locations behind.
 *
 * The Appwrite pass runs on R2 too: a map published before the move still has
 * its old files there. It never throws, and costs two requests when empty.
 */
export async function deleteSnapshots(mapId: string): Promise<void> {
  if (onR2()) await r2.deleteSnapshots(mapId);
  await appwrite.deleteSnapshots(mapId);
}

function onR2(): boolean {
  return env.snapshotPublicUrl !== "";
}
