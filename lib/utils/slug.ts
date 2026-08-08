/** URL-safe slug from a user-supplied name. Always returns something usable. */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    // Strip the combining marks that NFKD just separated out.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  // A name of only punctuation or non-Latin script would otherwise slugify to "".
  return slug || "map";
}

export function randomSuffix(length = 4): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
