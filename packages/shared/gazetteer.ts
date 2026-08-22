/**
 * Matching a typed query against the static place tables.
 *
 * The pure half of the embed's postcode-and-city search: folding, keying and
 * ranking, with no fetching and no cache. Here rather than in the embed for the
 * reason `tags.ts` and `shapes.ts` are — /packages/shared is the one directory
 * both build targets read, and it is the only place this can be held to a test
 * (CLAUDE.md §9 scopes vitest to lib/** and packages/**).
 *
 * That matters more here than anywhere else in the embed, because two of these
 * functions have a copy in scripts/build-gazetteer.mjs that no type connects
 * them to. `fold` has to agree with the script's `plainKey`, and `postKey` and
 * `shardOf` decide filenames the script writes and the embed asks for. When
 * those drift, nothing throws — search just quietly stops finding things.
 *
 * Zero dependencies, vanilla TS, per CLAUDE.md §4.
 */

/** `[keys, name, lat, lng]`, keys pipe-joined. Written by the build script. */
export type GazetteerEntry = [string, string, number, number];

export type GazetteerHit = {
  label: string;
  lat: number;
  lng: number;
};

/**
 * The visitor's query, folded to match the name keys in the files.
 *
 * A plain diacritic strip, and it has to stay exactly that: it is the same rule
 * the build script's `plainKey` applies to produce the second of the two keys
 * every entry carries. The first key is GeoNames' own transliteration — they
 * write Köln as "koeln" — which is why "Köln", "Koln" and "Koeln" all find the
 * same city while this function only has to handle the first two.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * How a postcode is keyed: case and separators removed, so "SW1A 1AA",
 * "sw1a1aa" and "SW1A-1AA" are one code and a visitor may type whichever they
 * think of.
 */
export function postKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Which shard file a code lives in.
 *
 * This names a file on disk, so it is the function that cannot drift from the
 * build script without the embed asking for shards that were never written.
 * Codes shorter than two characters get a padded bucket rather than falling out
 * of the sharding entirely.
 */
export function shardOf(code: string): string {
  return code.length >= 2 ? code.slice(0, 2) : `${code}_`;
}

/**
 * Place names, ranked so the answer the visitor meant comes first.
 *
 * Two tiers: the name starts with what they typed, then a word inside it does —
 * "york" should reach New York, but below every place actually called York.
 * Within a tier the file's own order wins, and the build script wrote it
 * biggest-population first, so "man" offers Manchester before Manningtree with
 * no ranking code here at all.
 */
export function matchNames(
  entries: readonly GazetteerEntry[],
  folded: string,
): GazetteerHit[] {
  const leading: GazetteerHit[] = [];
  const inner: GazetteerHit[] = [];

  for (const entry of entries) {
    const keys = entry[0].split("|");

    if (keys.some((key) => key.startsWith(folded))) {
      leading.push(hit(entry[1], entry));
      continue;
    }

    if (keys.some((key) => key.split(" ").some((word) => word.startsWith(folded)))) {
      inner.push(hit(entry[1], entry));
    }
  }

  return [...leading, ...inner];
}

/**
 * Postcodes, prefix-matched.
 *
 * A partial code is the normal case rather than a typo: "SW1" is four fifths of
 * a London postcode and someone typing it wants the area. The place name rides
 * along so the row reads "SW1A — Westminster" instead of offering a bare code
 * with no context.
 */
export function matchCodes(
  entries: readonly GazetteerEntry[],
  code: string,
): GazetteerHit[] {
  const hits: GazetteerHit[] = [];

  for (const entry of entries) {
    if (!entry[0].startsWith(code)) continue;

    hits.push(hit(entry[1] ? `${entry[0]} — ${entry[1]}` : entry[0], entry));
  }

  return hits;
}

function hit(label: string, entry: GazetteerEntry): GazetteerHit {
  return { label, lat: entry[2], lng: entry[3] };
}
