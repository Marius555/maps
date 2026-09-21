import "server-only";

import { promises as dns } from "node:dns";

/**
 * Can this domain receive mail at all?
 *
 * The half of the address check that does not go stale. A vendored blocklist
 * knows the throwaway services that existed when it was generated
 * (`lib/email/disposable.ts`); this knows whether the domain someone just typed
 * has a mail server today, which catches both the throwaway domain registered
 * this morning and the ordinary typo — `gmail.co`, `hotnail.com` — that would
 * otherwise become an account nobody can ever confirm.
 *
 * **Every uncertain answer is a yes, and that is the rule this file exists to
 * keep.** A resolver timeout, a SERVFAIL, a refused connection: none of them are
 * evidence against the address, and turning a DNS wobble into "you cannot sign
 * up" would be an outage of the one request a stranger makes before they are a
 * customer. Only two answers are decisive — the domain does not exist, or it
 * exists and has published nowhere to deliver.
 */

/** What this module needs from a resolver, so a test can hand it one. */
export type MailResolver = {
  resolveMx(hostname: string): Promise<{ exchange: string; priority: number }[]>;
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
};

/**
 * Long enough for a cold recursive lookup, short enough that nobody watches it.
 * Signup is a form submit someone is waiting on, and the fallback is "yes".
 */
const TIMEOUT_MS = 2_000;

/**
 * A domain that accepts mail will still accept it in six hours. A domain that
 * does not may be one someone is in the middle of setting up, or a resolver
 * being briefly wrong, so a refusal is re-asked much sooner — the expensive
 * mistake here is caching a "no" about an address that works.
 */
const TTL_OK_MS = 6 * 60 * 60 * 1000;
const TTL_BAD_MS = 10 * 60 * 1000;

/** Swept lazily past this, the same way `lib/auth/throttle.ts` keeps its map bounded. */
const MAX_TRACKED_KEYS = 5_000;

const cache = new Map<string, { ok: boolean; expiresAt: number }>();

export async function domainAcceptsMail(
  domain: string,
  resolver: MailResolver = dns,
): Promise<boolean> {
  const host = domain.trim().toLowerCase();
  if (!host) return false;

  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.expiresAt > now) return hit.ok;

  const answer = await withTimeout(lookup(host, resolver));

  // `null` is "we don't know" and is never cached: one blip must not vouch for a
  // domain for the next six hours, nor condemn one for the next ten minutes.
  if (answer === null) return true;

  if (cache.size > MAX_TRACKED_KEYS) sweep(now);
  cache.set(host, {
    ok: answer,
    expiresAt: now + (answer ? TTL_OK_MS : TTL_BAD_MS),
  });

  return answer;
}

/** `true` accepts mail, `false` demonstrably does not, `null` we could not tell. */
async function lookup(host: string, resolver: MailResolver): Promise<boolean | null> {
  try {
    const records = await resolver.resolveMx(host);

    if (records.length > 0) {
      // RFC 7505: a single `.` exchange is a domain saying, explicitly, that it
      // receives no mail. That is an answer, not an absence, so it does not fall
      // through to the address records below.
      return records.some((record) => record.exchange && record.exchange !== ".");
    }
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOTFOUND") return false;
    if (code !== "ENODATA") return null;
  }

  // No MX. RFC 5321 §5.1: the address records are then the implicit mail
  // exchange, and plenty of small domains rely on exactly that.
  for (const resolve of [resolver.resolve4, resolver.resolve6] as const) {
    try {
      if ((await resolve.call(resolver, host)).length > 0) return true;
    } catch (error) {
      const code = errorCode(error);
      if (code !== "ENOTFOUND" && code !== "ENODATA") return null;
    }
  }

  return false;
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

/**
 * `unref()` so a pending timer can never be the reason a process stays alive —
 * the losing half of the race is not cancelled, it is simply ignored.
 */
function withTimeout(work: Promise<boolean | null>): Promise<boolean | null> {
  return Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), TIMEOUT_MS).unref?.();
    }),
  ]);
}

function sweep(now: number): void {
  for (const [host, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(host);
  }
}

/** Test seam. Nothing in the app calls this. */
export function resetMxCache(): void {
  cache.clear();
}
