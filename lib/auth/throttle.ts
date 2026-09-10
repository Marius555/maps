import "server-only";

import { RepositoryError } from "@/lib/repositories/errors";

/**
 * Friction on the two routes that will mail a stranger on request.
 *
 * **Best effort, and it has to be said out loud.** The counters live in this
 * process's memory, so a second instance has its own set and a restart forgets
 * everything. That makes this abuse friction, not a guarantee — the same honesty
 * the domain allowlist carries in CLAUDE.md §7. It exists so that one person
 * holding down a button cannot turn our Resend quota into someone else's inbox
 * problem, and for that it is enough.
 *
 * Keyed by the caller rather than globally, because a global counter is a denial
 * of service against every other user the moment one person trips it.
 *
 * Deliberately not a repository: there is no row here and adding one would put a
 * write in the path of an unauthenticated request, which is the shape §2 spends
 * the whole document arguing against.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/**
 * Entries are only ever removed lazily, on a hit for the same key. A sweep runs
 * whenever the map grows past this, which is the cheapest way to stop a
 * long-lived process accumulating one entry per address ever typed.
 */
const MAX_TRACKED_KEYS = 5_000;

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type ThrottleOptions = {
  /** Distinguishes one caller from another — an email address, or an ip. */
  key: string;
  /** How many attempts the window allows. */
  limit: number;
  windowMs: number;
};

/**
 * Throws `rate_limited` once the caller is over the limit, and otherwise counts
 * this attempt and returns.
 *
 * The message says how long to wait, because "try again later" is the error
 * CLAUDE.md §8 exists to forbid.
 */
export function throttle({ key, limit, windowMs }: ThrottleOptions): void {
  const now = Date.now();

  if (windows.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    const seconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    const wait =
      seconds < 60
        ? `${seconds} seconds`
        : `${Math.ceil(seconds / 60)} minutes`;

    throw new RepositoryError(
      "rate_limited",
      `Too many attempts. Try again in ${wait}.`,
      429,
    );
  }

  existing.count += 1;
}

/** Test seam. Nothing in the app calls this. */
export function resetThrottles(): void {
  windows.clear();
}
