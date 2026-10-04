import "server-only";

/**
 * A second opinion from a list that is updated every day: DeBounce's free
 * disposable-domain lookup (`disposable.debounce.io`, no key).
 *
 * The vendored list goes stale the day it is generated, and a temp-mail service
 * that receives through Cloudflare or Yandex hides from the mail-server check
 * (`lib/email/disposable-mx.ts`). Measured on 2026-10-04 against obscure
 * throwaway domains, DeBounce caught three that Kickbox's equivalent missed.
 *
 * **Only the domain leaves this server.** The endpoint asks for an address, so
 * it is handed a placeholder at the domain, never the one somebody typed.
 *
 * **Every uncertain answer is a no**, the rule `lib/email/mx.ts` keeps: a timeout,
 * a non-200, a body we cannot read — none is evidence against the address, and
 * an upstream we do not control must never be able to close signup. Signup is
 * the only caller, and it is not in a map visitor's path (§2).
 */

const ENDPOINT = "https://disposable.debounce.io/";
const TIMEOUT_MS = 1_500;

/** A verdict either way holds for six hours; nothing undecided is cached. */
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_TRACKED_KEYS = 5_000;

const cache = new Map<string, { disposable: boolean; expiresAt: number }>();

export async function liveSaysDisposable(
  domain: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const host = domain.trim().toLowerCase();
  if (!host) return false;

  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.expiresAt > now) return hit.disposable;

  const verdict = await ask(host, fetcher);
  if (verdict === null) return false;

  if (cache.size > MAX_TRACKED_KEYS) {
    for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);
  }
  cache.set(host, { disposable: verdict, expiresAt: now + TTL_MS });

  return verdict;
}

async function ask(host: string, fetcher: typeof fetch): Promise<boolean | null> {
  try {
    const url = `${ENDPOINT}?email=${encodeURIComponent(`check@${host}`)}`;
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { disposable?: unknown };

    // It answers with the strings "true" / "false"; a boolean is read too, in
    // case that is ever tidied up.
    if (body.disposable === true || body.disposable === "true") return true;
    if (body.disposable === false || body.disposable === "false") return false;

    return null;
  } catch {
    return null;
  }
}

/** Test seam. Nothing in the app calls this. */
export function resetLiveCache(): void {
  cache.clear();
}
