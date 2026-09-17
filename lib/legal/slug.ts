/**
 * A heading's anchor id, made the way GitHub makes it.
 *
 * The documents were written and cross-referenced as Markdown on GitHub, so an
 * anchor already in circulation — `…/dpa#annex-iii--sub-processors` in
 * `documents/company.md` — has to land on the same heading here. GitHub's rule:
 * lowercase, drop every character that is not a letter, digit, space, hyphen or
 * underscore, then turn each space into a hyphen. Spaces are replaced one for
 * one, which is why "III — Sub" becomes `iii--sub`: the dash goes, both spaces
 * around it stay.
 */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}
