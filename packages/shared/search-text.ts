import type {
  SnapshotCategory,
  SnapshotPlace,
  SnapshotTagGroup,
} from "./snapshot";

/**
 * What the embed's search box actually searches.
 *
 * The box used to match a location's name and its address, and nothing else —
 * so a visitor typing "retail" on a map with a Retail category got nothing,
 * because the word they read off the pin's own card was not a word the search
 * had ever been shown. The chips answered that question instead; with those
 * gone, the search has to.
 *
 * A place stores a category *id* and bare tag ids, and the labels live on the
 * map. So the searchable text has to be composed, and it is composed **once**:
 * `matches` runs against every place on every keystroke, and a Pro map holds
 * 3,000 of them (CLAUDE.md §6) — resolving two lookups and lowercasing four
 * strings per place per character is work a mid-range phone can feel.
 *
 * Here rather than in embed/src for the same reason ./tags.ts and ./geo.ts are:
 * the vitest suite runs `lib/**` and `packages/**` only, so this is the only
 * side of the boundary where the rule can be held to a test. Zero dependencies,
 * vanilla TS — whatever this directory imports, the embed inherits (§4).
 */

/** Place id → everything about it a visitor might type, lowercased. */
export type SearchIndex = Map<string, string>;

export type SearchSource = {
  places: SnapshotPlace[];
  categories: SnapshotCategory[];
  tagGroups?: SnapshotTagGroup[];
};

export function buildSearchIndex({
  places,
  categories,
  tagGroups,
}: SearchSource): SearchIndex {
  const categoryLabels = new Map(
    categories.map((category) => [category.id, category.label]),
  );

  const tagLabels = new Map<string, string>();
  for (const group of tagGroups ?? []) {
    for (const tag of group.tags) tagLabels.set(tag.id, tag.label);
  }

  const index: SearchIndex = new Map();

  for (const place of places) {
    const parts = [place.name, place.address ?? ""];

    const category = categoryLabels.get(place.category ?? "");
    if (category) parts.push(category);

    for (const tag of place.tags ?? []) {
      // Only tags the map still defines. A place may be wearing an id for a tag
      // that was deleted, and matching the raw id would let a visitor find a
      // location by typing something no card on the map has ever shown them.
      const label = tagLabels.get(tag);
      if (label) parts.push(label);
    }

    index.set(place.id, parts.join(" ").toLowerCase());
  }

  return index;
}

/**
 * The query, prepared once per keystroke rather than once per place.
 *
 * Kept separate from `matches` so the caller does the trimming and lowercasing
 * a single time — which is the whole point of the index above.
 */
export function searchNeedle(query: string): string {
  return query.trim().toLowerCase();
}

/** An empty needle is "no search", not "no results". */
export function matchesSearch(
  index: SearchIndex,
  place: SnapshotPlace,
  needle: string,
): boolean {
  if (!needle) return true;

  return (index.get(place.id) ?? "").includes(needle);
}
