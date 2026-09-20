/**
 * R2 over its S3 API, for the Node scripts — which run as plain .mjs and cannot
 * import lib/. Mirrors lib/r2/client.ts's `put` (and its rule that no error
 * carries a credential), and the snapshot key layout and cache headers
 * mirror lib/snapshot/r2-store.ts. Change one, change the other.
 */

import { AwsClient } from "aws4fetch";

export const R2_ENV = ["CLOUDFLARE_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "SNAPSHOT_PUBLIC_URL"];

const CONTENT_TYPE = "application/json; charset=utf-8";
const LIVE_CACHE = "public, max-age=60";
const ARCHIVE_CACHE = "public, max-age=31536000, immutable";

/** The public origin snapshots are served from, or "" when R2 is not configured. */
export function snapshotPublicUrl() {
  return (process.env.SNAPSHOT_PUBLIC_URL ?? "").replace(/\/+$/, "");
}

export function liveKey(mapId) {
  return `${mapId}/live.json`;
}

export function archiveKey(mapId, generatedAt) {
  return `${mapId}/${generatedAt.replace(/[:.]/g, "-")}.json`;
}

export function publicUrl(key) {
  return `${snapshotPublicUrl()}/${key}`;
}

export function snapshotBucket() {
  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
    retries: 2,
  });
  const bucket = process.env.R2_SNAPSHOT_BUCKET || "snapshots";
  const base = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;

  async function put(key, body, cacheControl) {
    const response = await client.fetch(`${base}/${key}`, {
      method: "PUT",
      body,
      headers: { "content-type": CONTENT_TYPE, "cache-control": cacheControl },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const code = (await response.text()).match(/<Code>([^<]*)<\/Code>/)?.[1];
      throw new Error(`R2 PUT ${key} failed: HTTP ${response.status}${code ? ` ${code}` : ""}`);
    }
  }

  return {
    /**
     * Archive first, then the live object — the order uploadSnapshot uses, and for
     * the same reason: if the second write fails, the first is recoverable and the
     * previous live object is untouched. The live overwrite is atomic.
     */
    async writeSnapshot(mapId, body, stamp) {
      await put(archiveKey(mapId, stamp), body, ARCHIVE_CACHE);
      await put(liveKey(mapId), body, LIVE_CACHE);
    },
  };
}
