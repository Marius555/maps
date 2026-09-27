import { z } from "zod";

/**
 * The embed's domain allowlist.
 *
 * Anti-abuse, not security (CLAUDE.md §7): the snapshot is world-readable, so
 * anyone determined can read the data anyway. What this stops is a third party
 * casually pasting someone else's embed snippet onto their own site.
 *
 * An entry matches its own host and any subdomain, so "example.com" covers
 * "www.example.com" and "shop.example.com". Requiring a non-technical customer
 * to know they also need the www is a support ticket, not a safeguard.
 */

/** The maximum length of a DNS name, and the width of the column. */
const MAX_DOMAIN_LENGTH = 253;

export const MAX_ALLOWED_DOMAINS = 20;

const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/**
 * Accepts what people actually paste — a full URL, a host with a port, a
 * trailing slash — and stores the bare hostname.
 */
export function normalizeDomain(value: string): string {
  let candidate = value.trim().toLowerCase();
  if (!candidate) return "";

  // Strip a scheme and everything from the first path separator onwards.
  candidate = candidate.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  candidate = candidate.split(/[/?#]/)[0];
  // Port, and a trailing dot from a fully-qualified name.
  candidate = candidate.split(":")[0].replace(/\.$/, "");

  return candidate;
}

export const domainSchema = z
  .string()
  .transform(normalizeDomain)
  .refine((value) => value.length > 0, "Enter a domain, like example.com.")
  .refine(
    (value) => value.length <= MAX_DOMAIN_LENGTH,
    `Keep the domain under ${MAX_DOMAIN_LENGTH} characters.`,
  )
  .refine(
    (value) => HOSTNAME.test(value),
    "That doesn't look like a domain. Use something like example.com.",
  );

export const allowedDomainsSchema = z
  .array(domainSchema)
  .max(MAX_ALLOWED_DOMAINS, `You can allow up to ${MAX_ALLOWED_DOMAINS} domains.`)
  .transform((domains) => [...new Set(domains)]);

/**
 * What one press of "Add" does to the list: the domains to append, and the
 * entries it refused, each with the reason.
 *
 * One at a time is the normal case, but a list pasted into the one-line field
 * still works — split on commas and whitespace, since a list copied out of a
 * spreadsheet arrives comma-separated more often than not. Each entry is judged
 * on its own, so one typo does not throw away the nine good ones beside it.
 */
export type DomainEntryResult = {
  added: string[];
  rejected: { entry: string; reason: string }[];
};

export function parseDomainEntries(
  value: string,
  existing: readonly string[],
): DomainEntryResult {
  const entries = value.split(/[\s,]+/).filter(Boolean);
  const taken = new Set(existing);
  const added: string[] = [];
  const rejected: DomainEntryResult["rejected"] = [];

  if (entries.length === 0) {
    return { added, rejected: [{ entry: "", reason: "Enter a domain, like example.com." }] };
  }

  for (const entry of entries) {
    const parsed = domainSchema.safeParse(entry);

    if (!parsed.success) {
      rejected.push({ entry, reason: parsed.error.issues[0]?.message ?? "Invalid domain." });
    } else if (taken.has(parsed.data)) {
      rejected.push({ entry, reason: `${parsed.data} is already allowed.` });
    } else if (taken.size >= MAX_ALLOWED_DOMAINS) {
      rejected.push({ entry, reason: `You can allow up to ${MAX_ALLOWED_DOMAINS} domains.` });
    } else {
      taken.add(parsed.data);
      added.push(parsed.data);
    }
  }

  return { added, rejected };
}

/**
 * Does `hostname` satisfy the allowlist?
 *
 * Shared with the embed by copy rather than by import — the embed must not pull
 * in zod (CLAUDE.md §4) — so the rule is kept in one obvious place here and
 * mirrored in a handful of lines there.
 */
export function isDomainAllowed(hostname: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;

  const host = normalizeDomain(hostname);

  return allowed.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}
