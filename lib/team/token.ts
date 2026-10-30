import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * The secret in an invite link.
 *
 * 32 random bytes, base64url — 43 characters, safe in a URL path segment. Only
 * its sha256 is stored (`invites.tokenHash`), so the table is never a list of
 * working links; the token exists in the email, in the one response that hands
 * the inviter a "Copy link", and nowhere else.
 *
 * A path segment rather than a query parameter because `proxy.ts` drops the
 * query string on the redirects it makes, and because a link that survives the
 * signup round trip has to survive `?next=` too — `/invite/<token>` is a path
 * `safeRedirect` passes through unchanged.
 */

const TOKEN_BYTES = 32;

/** Seven days: long enough for a colleague on holiday, short enough to go stale. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function mintInviteToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Whether a path segment could be a token at all — checked before any read. */
export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
