import "server-only";

import { env } from "@/lib/env";
import { isDomainAllowed, normalizeDomain } from "@/lib/validation/domain.schema";
import { DISPOSABLE_DOMAINS } from "./disposable-domains.generated";

/**
 * Is this the domain of a throwaway mailbox?
 *
 * **Friction, not a guarantee** — the same honesty `lib/auth/throttle.ts` and the
 * embed's domain allowlist already carry (CLAUDE.md §7). A vendored list goes
 * stale the day after it is generated, and the services on it mint new domains
 * faster than anyone re-runs a script. `lib/email/mx.ts` is the half that catches
 * what this one has never heard of; together they raise the cost of a throwaway
 * signup rather than making one impossible, which is all a signup form can do.
 *
 * See `docs/notes/auth.md` and `scripts/build-disposable-domains.mjs`.
 */

/**
 * Built on the first question asked rather than at module load, so a deployment
 * that never sees a signup never pays for it — and the process that does pays
 * once. 75,000 short strings is a few megabytes of heap, which is worth it
 * exactly once and not on every cold start of a route that renders a map.
 */
let blocked: Set<string> | null = null;

function blocklist(): Set<string> {
  blocked ??= new Set(DISPOSABLE_DOMAINS.split("\n"));
  return blocked;
}

/** The part after the last `@`, normalised. `""` for anything that isn't an address. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";

  return normalizeDomain(email.slice(at + 1));
}

export function isDisposableDomain(domain: string): boolean {
  const host = normalizeDomain(domain);
  if (!host) return false;

  // The escape hatch that needs no redeploy: EMAIL_DOMAIN_ALLOWLIST wins over
  // the list outright. `isDomainAllowed` allows everything when the list is
  // empty, which is the right answer for the embed and the wrong one here — so
  // the emptiness is checked before it is consulted, not inside it.
  const allowed = env.emailDomainAllowlist;
  if (allowed.length > 0 && isDomainAllowed(host, allowed)) return false;

  const list = blocklist();
  const labels = host.split(".");

  // The host, then each parent, down to a floor of two labels: `inbox.mailinator.com`
  // is `mailinator.com`, and a provider that hands out subdomains is one entry
  // rather than one per customer. Stopping at two never asks whether `com` is on
  // the list — it isn't, but a list this size is not something to hand a bare TLD.
  for (let i = 0; i + 1 < labels.length; i += 1) {
    if (list.has(labels.slice(i).join("."))) return true;
  }

  return false;
}

/** Test seam. Nothing in the app calls this. */
export function resetDisposableCache(): void {
  blocked = null;
}
