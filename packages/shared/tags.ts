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

import type { SnapshotTagGroup } from "./snapshot";

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
