/**
 * Numbers formatted the same on both sides of a render.
 *
 * `toLocaleString()` with no locale asks the *runtime* what locale it is in.
 * Node takes that from the machine's OS settings, the browser from the user's
 * language — so a count rendered on the server as "3 000" arrives at a browser
 * that renders it "3,000", the markup doesn't match, and React throws the whole
 * tree away with a hydration error. It is invisible in development on an
 * en-US machine and appears the moment anyone else runs the app.
 *
 * The locale is pinned rather than threaded through, because the UI is English
 * only (CLAUDE.md §11 puts multi-language out of scope for v1). When that
 * changes, this is the one place to change it.
 */
const LOCALE = "en-US";

/** A whole number with thousands separators: 3000 → "3,000". */
export function formatCount(value: number): string {
  return value.toLocaleString(LOCALE);
}
