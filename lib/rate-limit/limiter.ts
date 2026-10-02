import "server-only";

import { RATE_LIMITS, type RatePolicyName } from "@/lib/limits/rate";
import { RateLimitError } from "@/lib/repositories/errors";

/**
 * Request-rate limiting: how often one caller may ask for something.
 *
 * **Best effort, and it has to be said out loud.** The counters live in this
 * process's memory, so a second instance has its own set and a restart forgets
 * everything. That makes this abuse friction, not a guarantee — the same honesty
 * the domain allowlist carries in CLAUDE.md §7. It is enough to stop one person
 * or one script hammering an endpoint, which is its job; a distributed flood is
 * the Cloudflare rule's (docs/notes/limits.md), and anything that must be exact —
 * what a plan allows, what an account has spent — is counted from stored rows,
 * never from here.
 *
 * Deliberately not a repository: there is no row here, and adding one would put
 * a database write in front of every request, including the flood this exists
 * to absorb.
 *
 * The numbers are in `lib/limits/rate.ts`. Nothing here should need to change
 * when one of them does.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/**
 * Entries are only ever removed lazily, on a hit for the same key. A sweep runs
 * whenever the map grows past this, which is the cheapest way to stop a
 * long-lived process accumulating one entry per address ever seen.
 */
const MAX_TRACKED_KEYS = 20_000;

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Count one request against `policy` for `key`, or throw `RateLimitError` if
 * the caller has used the window up.
 *
 * `key` is whatever the policy's `per` names — an account id, an IP, an email
 * address. The policy name is folded into the stored key, so the same account
 * has an independent budget per policy.
 */
export function rateLimit(policy: RatePolicyName, key: string): void {
  const { limit, windowMs } = RATE_LIMITS[policy];
  const now = Date.now();

  if (windows.size > MAX_TRACKED_KEYS) sweep(now);

  const id = `${policy}:${key}`;
  const existing = windows.get(id);

  if (!existing || existing.resetAt <= now) {
    windows.set(id, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    throw new RateLimitError((existing.resetAt - now) / 1000);
  }

  existing.count += 1;
}

const running = new Map<string, number>();

/**
 * Hold one of `max` slots for `key` while a request runs; throw if all are held.
 *
 * Returns the release, which the caller must run in a `finally` — a slot that is
 * never released locks the caller out until the process restarts, so this is
 * only for work whose end is certain (every request ends by the host's 30s cap).
 */
export function inFlight(key: string, max: number): () => void {
  const current = running.get(key) ?? 0;

  if (current >= max) {
    throw new RateLimitError(
      2,
      "Another lookup for this account is still running. Wait for it to finish, then try again.",
    );
  }

  running.set(key, current + 1);

  let released = false;

  return () => {
    if (released) return;
    released = true;

    const left = (running.get(key) ?? 1) - 1;

    if (left <= 0) running.delete(key);
    else running.set(key, left);
  };
}

/** Test seam. Nothing in the app calls this. */
export function resetRateLimits(): void {
  windows.clear();
  running.clear();
}
