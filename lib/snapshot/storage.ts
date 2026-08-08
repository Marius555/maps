import "server-only";

import { ID, Permission, Query, Role } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/appwrite/config";
import { env } from "@/lib/env";
import type { MapSnapshot } from "@/packages/shared/snapshot";

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
 * So: an immutable archive under a fresh id every time, and one live file at a
 * fixed id that the embed reads. The archive is written first and never touched
 * again, which is what makes a failed publish recoverable.
 *
 * The live file is replaced by delete-then-create — Appwrite Storage has no
 * atomic overwrite. That leaves a window, one upload long, in which the live URL
 * 404s. The embed retries once to cover it. Moving snapshots to R2 alongside the
 * PMTiles migration (§7) removes the window entirely, because R2 overwrites
 * atomically; until then this is the honest tradeoff and the embed compensates.
 */

/** Appwrite's ceiling for a file id. */
const MAX_FILE_ID = 36;
/** Archives retained per map, newest first. Enough to roll back, not unbounded. */
const ARCHIVES_KEPT = 5;

export type UploadedSnapshot = {
  /** Stable across republishes. This is what the embed snippet points at. */
  liveUrl: string;
  /** The immutable copy written by this publish. */
  archiveUrl: string;
};

/**
 * Fixed id for a map's live snapshot.
 *
 * Map ids come from ID.unique() (20 chars), so the prefix fits comfortably. The
 * slice is a guard for hand-created ids, not an expected path — two ids would
 * have to share a 31-character prefix to collide.
 */
export function liveFileId(mapId: string): string {
  return `live-${mapId}`.slice(0, MAX_FILE_ID);
}

export function snapshotFileUrl(fileId: string): string {
  return (
    `${APPWRITE_ENDPOINT}/storage/buckets/${env.snapshotStorageId}` +
    `/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`
  );
}

export async function uploadSnapshot(
  snapshot: MapSnapshot,
): Promise<UploadedSnapshot> {
  const { mapId } = snapshot;
  const body = JSON.stringify(snapshot);

  // Archive first. If anything after this fails, the published content still
  // exists and the previous live file is untouched.
  const archive = await admin.storage.createFile({
    bucketId: env.snapshotStorageId,
    fileId: ID.unique(),
    file: snapshotFile(body, `${mapId}-${fileTimestamp(snapshot.generatedAt)}.json`),
    permissions: publicRead(),
  });

  await replaceLiveFile(mapId, body);
  void pruneArchives(mapId);

  return {
    liveUrl: snapshotFileUrl(liveFileId(mapId)),
    archiveUrl: snapshotFileUrl(archive.$id),
  };
}

/** Removes a map's snapshots. Called when the map itself is deleted. */
export async function deleteSnapshots(mapId: string): Promise<void> {
  await removeFile(liveFileId(mapId));

  try {
    const { files } = await admin.storage.listFiles({
      bucketId: env.snapshotStorageId,
      queries: [Query.startsWith("name", `${mapId}-`), Query.limit(100)],
    });

    for (const file of files) await removeFile(file.$id);
  } catch (error) {
    console.error("Failed to list snapshots for map", mapId, error);
  }
}

async function replaceLiveFile(mapId: string, body: string): Promise<void> {
  const fileId = liveFileId(mapId);

  // Not "delete if exists" — a stale live file left behind by a half-finished
  // publish must be cleared the same way, so the delete is unconditional and
  // its 404 is ignored.
  await removeFile(fileId);

  await admin.storage.createFile({
    bucketId: env.snapshotStorageId,
    fileId,
    file: snapshotFile(body, `${mapId}-live.json`),
    permissions: publicRead(),
  });
}

/**
 * Best effort, and deliberately not awaited by the caller: a publish that wrote
 * both files has succeeded, and failing it over tidy-up would be absurd.
 */
async function pruneArchives(mapId: string): Promise<void> {
  const live = liveFileId(mapId);

  try {
    const { files } = await admin.storage.listFiles({
      bucketId: env.snapshotStorageId,
      queries: [
        Query.startsWith("name", `${mapId}-`),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ],
    });

    const stale = files.filter((file) => file.$id !== live).slice(ARCHIVES_KEPT);

    for (const file of stale) await removeFile(file.$id);
  } catch (error) {
    console.error("Failed to prune snapshot archives for map", mapId, error);
  }
}

/**
 * Public read, no session. This is the whole point: a visitor's browser fetches
 * it directly from storage, so nothing we pay for per request sits in their path
 * (CLAUDE.md §2). Writes still go through the admin client.
 */
function publicRead(): string[] {
  return [Permission.read(Role.any())];
}

function snapshotFile(body: string, name: string): File {
  return new File([body], name, { type: "application/json" });
}

/** ISO, minus the characters that make an awkward filename. */
function fileTimestamp(generatedAt: string): string {
  return generatedAt.replace(/[:.]/g, "-");
}

async function removeFile(fileId: string): Promise<void> {
  try {
    await admin.storage.deleteFile({
      bucketId: env.snapshotStorageId,
      fileId,
    });
  } catch {
    // Almost always "never existed", which is the normal first-publish case.
  }
}
