import "server-only";

import { createHash } from "node:crypto";

import type { AuthUser } from "./types";

/**
 * Who a session secret belongs to, remembered for a minute.
 *
 * Without it every page and every `/api` call asks Appwrite `account.get()`
 * before it can do anything else. React `cache()` only dedupes inside one
 * request, and a sidebar navigation does not re-run the dashboard layout, so the
 * page beneath it paid one serial round trip on every click — and each
 * TanStack query it then fired paid another.
 *
 * **Best effort per instance, said out loud** — the same honesty as
 * `lib/rate-limit/limiter.ts`. The entries live in this process's memory, so a
 * session revoked elsewhere (another device, another instance) is still
 * accepted here until its entry expires: at most `TTL_MS`. Logging out on this
 * device is immediate, because the cookie itself is gone. Everything that
 * changes what an `AuthUser` says or which sessions exist calls `forgetUser` or
 * `forgetSession`, so this instance never shows a stale name or a stale
 * verification gate.
 *
 * Keyed by a SHA-256 of the secret, never the secret itself: the secret *is*
 * the login, and a heap dump should not hand one out. Only successful lookups
 * are stored; a refusal is never remembered.
 */

export const TTL_MS = 60_000;

/** A sweep of expired entries runs whenever the map grows past this. */
export const MAX_ENTRIES = 10_000;

type Entry = { user: AuthUser; expiresAt: number };

/**
 * **On `globalThis`, never a plain module-level `Map`.** Next bundles route
 * handlers and pages as separate module instances, so a module-level map
 * exists twice in one process: logout cleared the `/api` copy and every page
 * went on accepting the revoked cookie from its own, measured. One store per
 * process is what makes `forgetSession` / `forgetUser` reach the pages.
 */
const STORE = Symbol.for("map.auth.identityCache");

const entries: Map<string, Entry> = ((globalThis as Record<symbol, unknown>)[STORE] ??=
  new Map<string, Entry>()) as Map<string, Entry>;

function keyOf(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function sweep(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

export function readCachedUser(secret: string): AuthUser | null {
  const key = keyOf(secret);
  const entry = entries.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    return null;
  }

  return entry.user;
}

export function rememberUser(secret: string, user: AuthUser): void {
  const now = Date.now();

  if (entries.size >= MAX_ENTRIES) sweep(now);
  // Still full of live entries: drop the oldest rather than grow without bound.
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }

  entries.set(keyOf(secret), { user, expiresAt: now + TTL_MS });
}

/** This one session: logout, or a secret Appwrite has just refused. */
export function forgetSession(secret: string): void {
  entries.delete(keyOf(secret));
}

/**
 * Every session of this account on this instance — for changes where the
 * other sessions' secrets are unknown (a name, a verified address, sessions
 * revoked, a password changed, the account deleted). The caller's own session
 * simply asks Appwrite again on its next request.
 */
export function forgetUser(userId: string): void {
  for (const [key, entry] of entries) {
    if (entry.user.id === userId) entries.delete(key);
  }
}

/** Tests only. */
export function clearIdentityCache(): void {
  entries.clear();
}

/** Tests only. */
export function identityCacheKeys(): string[] {
  return [...entries.keys()];
}
