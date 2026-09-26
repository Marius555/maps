import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Who a visitor is, for one month, on one map — without a cookie.
 *
 * Unique and returning visitors need *something* that stays the same across
 * page loads, and the embed deliberately keeps nothing between them
 * (embed/src/track.ts: no cookie, no storage). So the key is derived here, on
 * the server, from what every request carries anyway: the IP address and the
 * user agent. Nothing is stored on the visitor's device and the embed is
 * unchanged.
 *
 * Three things are mixed in, and each is doing a job:
 *
 * - **The month (`YYYY-MM`, UTC).** The key changes on the 1st, so a person can
 *   be recognised as returning within a month and never beyond it. That is the
 *   window the owner chose; a longer one is a longer-lived identifier.
 * - **The map id.** The same person gets a different key on every map, so no
 *   two customers' figures — and no two sites — can be joined on it.
 * - **A secret salt.** Without it the key is a hash of an IP address, and an
 *   IPv4 address space is small enough to reverse by brute force.
 *
 * The full IP is read here and then discarded: what is stored is the key and a
 * truncated address (./truncate-ip.ts), and the key cannot be worked back to
 * either. Two people behind one address with the same browser build read as one
 * visitor; one person whose phone changes network reads as two. That is the
 * price of not storing anything on the device, and the figures are estimates
 * for it.
 *
 * Null without an IP: a key of the user agent alone would merge every visitor on
 * the same browser version into one.
 */
export function visitorKey(input: {
  mapId: string;
  ip: string | null;
  userAgent: string | null;
  now: Date;
}): string | null {
  if (!input.ip) return null;

  return createHash("sha256")
    .update(salt())
    .update("\n")
    .update(input.now.toISOString().slice(0, 7))
    .update("\n")
    .update(input.mapId)
    .update("\n")
    .update(input.ip)
    .update("\n")
    .update(input.userAgent ?? "")
    .digest("hex")
    .slice(0, VISITOR_KEY_LENGTH);
}

/** Hex characters kept — 64 bits, and the width of the `visitor` column. */
export const VISITOR_KEY_LENGTH = 16;

/**
 * `ANALYTICS_SALT`, or one derived from the API key when it is unset.
 *
 * Derived rather than the key itself, so the API key never goes into a hash
 * input verbatim alongside data a visitor controls.
 */
function salt(): string {
  if (env.analyticsSalt) return env.analyticsSalt;

  return createHash("sha256")
    .update(`visitor-salt:${env.appwriteApiKey}`)
    .digest("hex");
}
