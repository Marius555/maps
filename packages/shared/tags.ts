/**
 * Matching a place against selected tags.
 *
 * Here rather than in the embed for the reason `shapes.ts` and `darken-style.ts`
 * are: the editor's preview panel renders the real embed bundle beside the
 * editor's own canvas, and the moment the dashboard grows its own tag filter —
 * the locations list already filters by category — two copies of this rule would
 * be two different sets of pins on one screen.
 *
 * Zero dependencies, vanilla TS, per CLAUDE.md §4.
 */

import type { SnapshotTag, SnapshotTagGroup } from "./snapshot";

/**
 * Which group each tag belongs to.
 *
 * Built once and reused, because `matchesTags` runs per place per keystroke and
 * walking every group's tag list each time is three thousand places times sixty
 * tags of work per character typed.
 *
 * A place stores bare tag ids and never records which group they came from,
 * which is why tag ids are unique across the whole map
 * (lib/validation/tag.schema.ts) — two groups sharing an id would make one chip
 * answer two questions at once.
 */
export function tagGroupIndex(
  groups: readonly SnapshotTagGroup[],
): Map<string, string> {
  const index = new Map<string, string>();

  for (const group of groups) {
    for (const tag of group.tags) index.set(tag.id, group.id);
  }

  return index;
}

/**
 * OR within a group, AND across groups.
 *
 * "Sells bikes OR sells skis, AND opens on Sundays" is the shape of a real
 * search, and both simpler rules are wrong in ways a visitor notices. AND
 * everywhere means ticking a second product line returns *fewer* shops rather
 * than more, which reads as the filter being broken. OR everywhere means the
 * opening-hours question stops narrowing anything at all once a product is
 * ticked.
 *
 * Nothing selected means everything is shown — an empty filter is "no filter",
 * not "no results", the same reading `matchesCategories` gives.
 */
export function matchesTags(
  placeTags: readonly string[] | undefined,
  selected: ReadonlySet<string>,
  groupOf: ReadonlyMap<string, string>,
): boolean {
  if (selected.size === 0) return true;

  const worn = new Set(placeTags ?? []);
  /** Group id → has this place answered that group's question yet. */
  const satisfied = new Map<string, boolean>();

  for (const id of selected) {
    /*
     * A selected tag whose group is unknown gets a bucket of its own rather than
     * being skipped. Skipping it would silently widen the filter — the visitor
     * ticked something and the result set grew — and an unknown id here means
     * the index and the selection disagree, which is a bug worth showing as
     * "nothing matches" rather than hiding as "everything matches".
     */
    const group = groupOf.get(id) ?? id;

    if (!satisfied.has(group)) satisfied.set(group, false);
    if (worn.has(id)) satisfied.set(group, true);
  }

  for (const answered of satisfied.values()) {
    if (!answered) return false;
  }

  return true;
}

/**
 * A map's tag ids, resolved to labels once.
 *
 * Here, beside `tagGroupIndex`, for the reason that function gives: the card
 * block that draws these is rendered by React in the dashboard and by hand-built
 * DOM in the embed, and the preview panel puts both on one screen. A lookup
 * table built two ways is two different sets of chips on one card.
 *
 * **Ids the map no longer defines are dropped, not rendered as themselves.**
 * Nothing sweeps a deleted tag off the places wearing it — Appwrite has no
 * array-remove, and rewriting 3,000 rows to tidy ids no visitor can see is not a
 * trade worth making (lib/validation/tag.schema.ts) — so a dangling id is the
 * normal state, and drawing one would put `tag-3f9a1c04` on a customer's card.
 *
 * Group order is the map's own, so a location's chips come out in the order its
 * owner arranged the filters rather than in the order the ids happen to sit in
 * the row.
 */
export function tagLabelsOf(
  groups: readonly SnapshotTagGroup[],
  placeTags: readonly string[] | undefined,
): string[] {
  if (!placeTags || placeTags.length === 0) return [];

  const worn = new Set(placeTags);
  const labels: string[] = [];

  for (const group of groups) {
    for (const tag of group.tags) {
      if (worn.has(tag.id)) labels.push(tag.label);
    }
  }

  return labels;
}

/**
 * One tag, ready to draw.
 *
 * Named rather than written inline at each use because four renderers pass it
 * around — the editor's card, the designer's, the embed's popup and its list —
 * and `color` being optional is the part they all have to agree on.
 */
export type TagChip = { id: string; label: string; color?: string };

/**
 * A place's tags as chips, **in the place's own order**.
 *
 * `tagLabelsOf` above reads the map's order, which is right for a vocabulary and
 * wrong for this: since categories merged into tags, the pin takes the colour of
 * the location's *first* tag (lib/validation/tag.schema.ts), so the chip a
 * visitor reads first has to be the one the pin in front of them is wearing.
 * Sorting these into map order would put a different chip there and quietly make
 * the card disagree with the map.
 *
 * Dangling ids are dropped on the same rule `tagLabelsOf` gives — nothing sweeps
 * a deleted tag off the places wearing it, so drawing one would put
 * `tag-3f9a1c04` on a customer's card.
 *
 * A tag with no colour of its own is returned with none rather than a guess. The
 * renderers each have a fallback that is right for where they draw — an editor
 * pin falls back to the theme accent, a published one to a flat grey — and a
 * colour invented here would override both.
 */
export function tagChipsOf(
  groups: readonly SnapshotTagGroup[],
  placeTags: readonly string[] | undefined,
): TagChip[] {
  if (!placeTags || placeTags.length === 0) return [];

  const byId = new Map<string, SnapshotTag>();

  for (const group of groups) {
    for (const tag of group.tags) byId.set(tag.id, tag);
  }

  const chips: TagChip[] = [];

  for (const id of placeTags) {
    const tag = byId.get(id);
    if (tag) chips.push({ id: tag.id, label: tag.label, color: tag.color });
  }

  return chips;
}

/**
 * The colour a place's pin takes from its tags: its first tag's.
 *
 * Undefined when it wears none, when the first few name tags the map has since
 * deleted, or when the tag that answers has no colour — every caller has its own
 * fallback and this must not pre-empt any of them. It walks rather than reading
 * `tags[0]` for exactly that reason: a dangling id at the front would otherwise
 * make a pin colourless while the card beside it drew three chips.
 */
export function pinColorOfTags(
  groups: readonly SnapshotTagGroup[],
  placeTags: readonly string[] | undefined,
): string | undefined {
  return pinColorOfChips(tagChipsOf(groups, placeTags));
}

/**
 * The same answer, for a caller that already has the chips.
 *
 * The card renderers resolve a place's chips to draw them and would otherwise
 * resolve them a second time to find out what colour the pin beside them is —
 * and two walks of the same list is exactly how the dot on the card and the pin
 * on the map start disagreeing.
 */
export function pinColorOfChips(chips: readonly TagChip[]): string | undefined {
  return chips.find((chip) => chip.color)?.color;
}
