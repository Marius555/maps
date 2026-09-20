import "server-only";

import { AwsClient } from "aws4fetch";

import { env } from "@/lib/env";

/**
 * Cloudflare R2, over its S3 API — the three operations publishing needs.
 *
 * `aws4fetch` rather than the AWS SDK: it signs a `fetch` and nothing else, has
 * no dependencies, and is what Cloudflare's own R2 docs use. Server-only by
 * construction — the credentials are in `env`, and `server-only` fails the build
 * of any client component that reaches this file.
 *
 * **No error thrown from here may carry a credential.** They end up in logs
 * (`toErrorResponse` prints unhandled errors), so they name the operation, the
 * object key, the HTTP status and R2's error code, and stop there.
 */

export type R2Bucket = {
  /** Replaces the object atomically: a reader sees the old body or the new one, never neither. */
  put(key: string, body: string, headers: PutHeaders): Promise<void>;
  /** Every key under `prefix`, in R2's order (lexicographic). */
  list(prefix: string): Promise<string[]>;
  /** Succeeds whether or not the key existed, as S3's DELETE does. */
  remove(key: string): Promise<void>;
};

export type PutHeaders = {
  contentType: string;
  cacheControl: string;
};

/**
 * Three attempts, not aws4fetch's default of eleven. Its backoff doubles from
 * 50ms, so the default can spend ~25s retrying — and Appwrite Sites cuts every
 * request off at 30s (CLAUDE.md §12). A publish should fail and say so instead.
 */
const RETRIES = 2;
const REQUEST_TIMEOUT_MS = 10_000;

export function r2Bucket(bucket: string): R2Bucket {
  const client = new AwsClient({
    ...credentials(),
    service: "s3",
    region: "auto",
    retries: RETRIES,
  });
  const base = `https://${env.r2AccountId}.r2.cloudflarestorage.com/${bucket}`;

  async function send(
    method: string,
    url: string,
    label: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const response = await client.fetch(url, {
      ...init,
      method,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const code = errorCode(await response.text());
      throw new Error(
        `R2 ${method} ${label} failed: HTTP ${response.status}${code ? ` ${code}` : ""}`,
      );
    }

    return response;
  }

  return {
    async put(key, body, headers) {
      await send("PUT", `${base}/${encodeKey(key)}`, key, {
        body,
        headers: {
          "content-type": headers.contentType,
          "cache-control": headers.cacheControl,
        },
      });
    },

    async list(prefix) {
      const keys: string[] = [];
      let token: string | null = null;

      // A map holds a handful of objects, so this is one page in practice. The
      // loop is there so a prefix that ever grows past 1,000 is not silently cut.
      do {
        const query = new URLSearchParams({ "list-type": "2", prefix });
        if (token) query.set("continuation-token", token);

        const response = await send("GET", `${base}?${query}`, `list ${prefix}`);
        const xml = await response.text();

        keys.push(...tagValues(xml, "Key"));
        token = tagValues(xml, "IsTruncated")[0] === "true"
          ? (tagValues(xml, "NextContinuationToken")[0] ?? null)
          : null;
      } while (token);

      return keys;
    },

    async remove(key) {
      await send("DELETE", `${base}/${encodeKey(key)}`, key);
    },
  };
}

function credentials(): { accessKeyId: string; secretAccessKey: string } {
  const missing = missingConfig();

  if (missing.length > 0) {
    throw new Error(
      `R2 is not configured: ${missing.join(", ")} missing. SNAPSHOT_PUBLIC_URL is ` +
        "set, so publishing writes to R2 — add the missing values to the " +
        "environment and redeploy, or unset SNAPSHOT_PUBLIC_URL.",
    );
  }

  return {
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
  };
}

function missingConfig(): string[] {
  const values: Record<string, string> = {
    CLOUDFLARE_ACCOUNT_ID: env.r2AccountId,
    R2_ACCESS_KEY_ID: env.r2AccessKeyId,
    R2_SECRET_ACCESS_KEY: env.r2SecretAccessKey,
  };

  return Object.keys(values).filter((name) => !values[name]);
}

/** Each path segment encoded, the slashes between them kept. */
export function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/**
 * Text content of every `<tag>` in an S3 XML response.
 *
 * A regex rather than a parser because Node has no DOMParser, the responses are
 * flat, and the keys are our own. The entity decode is for completeness: none of
 * the keys we write contain a character XML would escape.
 */
function tagValues(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>([^<]*)</${tag}>`, "g");

  return [...xml.matchAll(pattern)].map((match) => decodeEntities(match[1]));
}

function errorCode(xml: string): string | undefined {
  return tagValues(xml, "Code")[0];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
