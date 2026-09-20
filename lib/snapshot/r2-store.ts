import "server-only";

import { env } from "@/lib/env";
import { r2Bucket } from "@/lib/r2/client";
import type { MapSnapshot } from "@/packages/shared/snapshot";

import type { UploadedSnapshot } from "./storage";

/**
 * Snapshots on Cloudflare R2, served from `SNAPSHOT_PUBLIC_URL`
 * (`https://cdn.pinglide.com`), the bucket's custom domain.
 *
 *   {mapId}/{generatedAt}.json   immutable archive, one per publish
 *   {mapId}/live.json            what the embed reads, overwritten in place
 *
 * The overwrite is atomic — R2 serves the old body or the new one, never a 404 —
 * which is the delete-then-create window the Appwrite store has and this one
 * does not. The archive is still written first, so a publish that fails half way
 * leaves the previous live file untouched and the new content recoverable.
 *
 * The two objects carry different `Cache-Control`, and that is where the cache
 * policy lives — the zone's cache rule respects it (`npm run setup:r2`):
 *
 * - **Live, 60 seconds.** Its URL never changes, so the TTL is how long a
 *   republish takes to reach a visitor. A minute keeps the edge answering almost
 *   every request — each miss is a paid R2 read (CLAUDE.md §2) — while an owner
 *   who just pressed Publish is not left wondering.
 * - **Archive, a year and immutable.** A timestamped key is never rewritten.
 */

const LIVE = "live.json";
const ARCHIVES_KEPT = 5;
const CONTENT_TYPE = "application/json; charset=utf-8";
const LIVE_CACHE = "public, max-age=60";
const ARCHIVE_CACHE = "public, max-age=31536000, immutable";

export function liveKey(mapId: string): string {
  return `${mapId}/${LIVE}`;
}

/**
 * ISO, minus `:` and `.` — still sorts chronologically, which is what pruning
 * leans on instead of asking R2 for dates.
 */
export function archiveKey(mapId: string, generatedAt: string): string {
  return `${mapId}/${generatedAt.replace(/[:.]/g, "-")}.json`;
}

export function publicUrl(key: string): string {
  return `${env.snapshotPublicUrl}/${key}`;
}

export async function uploadSnapshot(
  snapshot: MapSnapshot,
): Promise<UploadedSnapshot> {
  const { mapId } = snapshot;
  const bucket = r2Bucket(env.r2SnapshotBucket);
  const body = JSON.stringify(snapshot);
  const archive = archiveKey(mapId, snapshot.generatedAt);

  await bucket.put(archive, body, {
    contentType: CONTENT_TYPE,
    cacheControl: ARCHIVE_CACHE,
  });
  await bucket.put(liveKey(mapId), body, {
    contentType: CONTENT_TYPE,
    cacheControl: LIVE_CACHE,
  });

  // Not awaited: a publish that wrote both objects has succeeded, and failing it
  // over tidy-up would be absurd.
  void pruneArchives(mapId);

  return { liveUrl: publicUrl(liveKey(mapId)), archiveUrl: publicUrl(archive) };
}

export async function deleteSnapshots(mapId: string): Promise<void> {
  const bucket = r2Bucket(env.r2SnapshotBucket);

  for (const key of await bucket.list(`${mapId}/`)) {
    await bucket.remove(key);
  }
}

/** Keeps the newest few archives. Best effort, like the Appwrite store's. */
export async function pruneArchives(mapId: string): Promise<void> {
  try {
    const bucket = r2Bucket(env.r2SnapshotBucket);
    const stale = (await bucket.list(`${mapId}/`))
      .filter((key) => key !== liveKey(mapId))
      .sort()
      .reverse()
      .slice(ARCHIVES_KEPT);

    for (const key of stale) await bucket.remove(key);
  } catch (error) {
    console.error("Failed to prune snapshot archives for map", mapId, error);
  }
}
