/**
 * Contact details as spreadsheets actually write them.
 *
 * A website column holds "www.equinox.com", not "https://www.equinox.com" —
 * people type the thing they'd say out loud, and Excel doesn't correct it. But
 * `createPlaceSchema` validates the column with `z.url()`, which requires a
 * scheme, so every one of those rows was rejected. Worse, the rejection came
 * back as one "Check the highlighted fields and try again." for the *whole
 * chunk*: 200 perfectly good locations refused because one of them wrote its
 * address the normal way.
 *
 * So two rules, and the second matters as much as the first:
 *
 * 1. Repair what is obviously repairable. A bare domain is a website.
 * 2. Never let an optional contact field block the import. If a value can't be
 *    made valid, drop the value and keep the location — a malformed email in row
 *    47 is not a reason to lose row 47, let alone the other 199.
 *
 * The drops are counted, not hidden: `buildDraftPlaces` reports them and the
 * review step says so before anything is saved (CLAUDE.md §7).
 */

/** A scheme, per RFC 3986: a letter then letters, digits, +, - or . */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Something with a dot and a plausible TLD after it.
 *
 * The guard against prepending "https://" to junk. `new URL()` is happy to parse
 * "https://N/A" — it reads "n" as the host — so without this, a column of "N/A"
 * and "-" would import as a page of broken links.
 */
const LOOKS_LIKE_DOMAIN = /^[^\s/@]+\.[a-z]{2,}(?=$|[/:?#])/i;

const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

/**
 * A website column value → something `z.url()` accepts, or "" if it can't be.
 *
 * https rather than http: it's 2026, the schema doesn't care which, and guessing
 * the insecure one would be a downgrade we chose on the user's behalf.
 */
export function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  const candidate = HAS_SCHEME.test(value)
    ? value
    : LOOKS_LIKE_DOMAIN.test(value)
      ? `https://${value}`
      : "";

  if (!candidate) return "";

  // Parsed rather than pattern-matched, because this has to agree with the
  // schema that runs on the server — and that one is `z.url()`, which is
  // `new URL()` underneath. A regex that disagreed with it would send the
  // import back to the same rejection it is here to prevent.
  try {
    new URL(candidate);
  } catch {
    return "";
  }

  return candidate;
}

/** An email column value, or "" when it isn't one. */
export function normalizeEmail(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  // "mailto:" is common in feeds exported from a CMS, and the address after it
  // is perfectly good.
  const stripped = value.replace(/^mailto:/i, "");

  return EMAIL.test(stripped) ? stripped : "";
}
