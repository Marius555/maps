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

/**
 * The bucket itself, for anything the scripts put on the CDN host: snapshots
 * (below) and the embed's own files (scripts/upload-cdn.mjs). One bucket, one
 * custom domain, one CORS rule — map ids are Appwrite ids, so `embed/` and
 * `gazetteer/` can never collide with a `{mapId}/` prefix.
 */
export function r2Bucket() {
  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
    retries: 2,
  });
  const bucket = process.env.R2_SNAPSHOT_BUCKET || "snapshots";
  const base = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;

  return {
    async put(key, body, { contentType, cacheControl }) {
      const response = await client.fetch(`${base}/${key}`, {
        method: "PUT",
        body,
        headers: { "content-type": contentType, "cache-control": cacheControl },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const code = (await response.text()).match(/<Code>([^<]*)<\/Code>/)?.[1];
        throw new Error(`R2 PUT ${key} failed: HTTP ${response.status}${code ? ` ${code}` : ""}`);
      }
    },

    /**
     * The object's ETag, unquoted, or null when there is no such object. For a
     * single-part PUT R2's ETag is the body's MD5, which is what lets an upload
     * skip a file that has not changed.
     */
    async etag(key) {
      const response = await client.fetch(`${base}/${key}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`R2 HEAD ${key} failed: HTTP ${response.status}`);

      // R2 marks the ETag weak (`W/"…"`) on compressible types, which is most of
      // what the embed ships; the hash inside is still the body's MD5.
      return (response.headers.get("etag") ?? "").replace(/^W\//, "").replace(/"/g, "") || null;
    },
  };
}

export function snapshotBucket() {
  const bucket = r2Bucket();

  return {
    /**
     * Archive first, then the live object — the order uploadSnapshot uses, and for
     * the same reason: if the second write fails, the first is recoverable and the
     * previous live object is untouched. The live overwrite is atomic.
     */
    async writeSnapshot(mapId, body, stamp) {
      await bucket.put(archiveKey(mapId, stamp), body, {
        contentType: CONTENT_TYPE,
        cacheControl: ARCHIVE_CACHE,
      });
      await bucket.put(liveKey(mapId), body, {
        contentType: CONTENT_TYPE,
        cacheControl: LIVE_CACHE,
      });
    },
  };
}
