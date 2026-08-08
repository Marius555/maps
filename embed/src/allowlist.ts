/**
 * Domain allowlist check.
 *
 * A deliberate copy of `isDomainAllowed` in lib/validation/domain.schema.ts
 * rather than an import: that module pulls in zod, and nothing from the
 * dashboard's runtime may cross into this bundle (CLAUDE.md §4). The rule is
 * eight lines, so a copy with a pointer beats a shared package.
 *
 * This is anti-abuse, not security (§7). The snapshot is a public file; anyone
 * who wants the data can fetch it. What this stops is a third party pasting
 * someone else's snippet onto their own site and getting a working map.
 */
export function isDomainAllowed(hostname: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;

  const host = hostname.trim().toLowerCase().replace(/\.$/, "");

  return allowed.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}
