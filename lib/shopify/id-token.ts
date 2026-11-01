import { createHmac, timingSafeEqual } from "node:crypto";

import { parseShopDomain } from "./shop-domain";

/**
 * Shopify's ID token (formerly "session token"): a JWT App Bridge issues to the
 * page running inside the Shopify admin, signed with the app's client secret.
 * It is the **only** credential the embedded app has — Shopify requires embedded
 * apps to work without third-party cookies, so our session cookie never reaches
 * a page inside the admin's iframe (docs/notes/shopify.md).
 *
 * Verified by hand with `node:crypto` rather than through a JWT library: it is
 * one algorithm (HS256) with one key, and §3 asks before every dependency.
 * The checks are the ones Shopify documents and its own `decodeSessionToken`
 * makes, with the same 10-second clock tolerance:
 *
 * - the signature, HS256 over `header.payload` with the client secret;
 * - `aud` is our client id;
 * - `exp` is in the future and `nbf` in the past;
 * - `iss` and `dest` name the same shop, and it is a `*.myshopify.com` domain.
 *
 * Pure and synchronous, so `proxy.ts` can call it without a network request.
 * It never throws: every way a token can be wrong is the same answer, null.
 */

export const CLOCK_TOLERANCE_SECONDS = 10;

export type IdTokenClaims = {
  /** `https://<shop>/admin` */
  iss: string;
  /** `https://<shop>` */
  dest: string;
  /** Our client id. */
  aud: string;
  /** The Shopify staff member's user id. */
  sub?: string;
  exp: number;
  nbf: number;
  iat?: number;
  jti?: string;
  sid?: string;
};

export type VerifiedIdToken = {
  /** The shop's `*.myshopify.com` domain, lower-cased. */
  shop: string;
  claims: IdTokenClaims;
};

export type IdTokenKeys = {
  clientId: string;
  clientSecret: string;
};

export function verifyIdToken(
  token: string,
  keys: IdTokenKeys,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifiedIdToken | null {
  if (!token || !keys.clientId || !keys.clientSecret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const head = decodeJson(header);
  if (!head || head.alg !== "HS256") return null;

  const expected = createHmac("sha256", keys.clientSecret)
    .update(`${header}.${payload}`)
    .digest();
  const given = fromBase64Url(signature);
  if (!given || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  const claims = decodeJson(payload);
  if (!claims || !isClaims(claims)) return null;

  if (claims.aud !== keys.clientId) return null;
  if (claims.exp + CLOCK_TOLERANCE_SECONDS <= nowSeconds) return null;
  if (claims.nbf - CLOCK_TOLERANCE_SECONDS > nowSeconds) return null;

  const destShop = parseShopDomain(hostnameOf(claims.dest));
  const issShop = parseShopDomain(hostnameOf(claims.iss));
  if (!destShop || destShop !== issShop) return null;

  return { shop: destShop, claims };
}

/** The token in an `Authorization: Bearer …` header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function isClaims(value: Record<string, unknown>): value is IdTokenClaims {
  return (
    typeof value.iss === "string" &&
    typeof value.dest === "string" &&
    typeof value.aud === "string" &&
    typeof value.exp === "number" &&
    typeof value.nbf === "number"
  );
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function decodeJson(part: string): Record<string, unknown> | null {
  const bytes = fromBase64Url(part);
  if (!bytes) return null;

  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function fromBase64Url(part: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]*$/.test(part)) return null;

  return Buffer.from(part, "base64url");
}
