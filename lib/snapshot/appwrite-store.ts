import "server-only";

import { ID, Permission, Query, Role } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/appwrite/config";
import { env } from "@/lib/env";
import type { MapSnapshot } from "@/packages/shared/snapshot";

import type { UploadedSnapshot } from "./storage";

/**
 * Snapshots on Appwrite Storage — the store used when `SNAPSHOT_PUBLIC_URL` is
 * unset. Development and self-hosting only: Appwrite answers 403
 * `general_unknown_origin` to any Origin not registered as a Web platform, and
 * the embed's `fetch` always sends one, so a map published here loads on the
 * dashboard's own origin and on no customer's site. See `./storage.ts`.
 *
 * The live file is replaced by delete-then-create — Appwrite Storage has no
 * atomic overwrite. That leaves a window, one upload long, in which the live URL
 * 404s, and the embed's single retry covers it.
 */

/** Appwrite's ceiling for a file id. */
const MAX_FILE_ID = 36;
/** Archives retained per map, newest first. Enough to roll back, not unbounded. */
const ARCHIVES_KEPT = 5;

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

/**
 * Removes a map's snapshots. Also run when the map lives on R2, because a map
 * published before the move still has its old files here.
 */
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
 * Public read, no session: a visitor's browser fetches it directly from
 * storage. Writes still go through the admin client.
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
