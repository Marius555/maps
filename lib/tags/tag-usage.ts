/**
 * Which tags of a map's vocabulary anybody actually wears.
 *
 * **The vocabulary and the places drift apart, and only in one direction.** A
 * tag is minted when a location is imported or a chip is typed, and nothing ever
 * takes it back: `deletePlace` deletes a row and touches nothing else, an import
 * that stops half way has already written the tags for rows it never saved, and
 * `migrate:tags` folds in every category whether or not one was ever used. So a
 * map whose locations have all been replaced still offers every tag its first
 * import invented. Measured on a real map: seven locations, fourteen tags in the
 * filter menu, five of them worn by nobody.
 *
 * That is not a bug in the data — CLAUDE.md's rule that dangling ids are the
 * normal state cuts both ways, and sweeping vocabulary on delete would throw
 * away tags an owner is about to re-import into. It is a bug in the *filter*: a
 * chip that can only ever return an empty list is a dead control.
 *
 * The publish path has always known this (`usedTagGroups` in
 * lib/snapshot/build.ts), which is why a published map is correct and only the
 * dashboard was wrong. This is that rule, lifted out so there is one of it.
 *
 * **In `lib/` and not `packages/shared/`**, deliberately: the embed reads a
 * snapshot that arrives already narrowed, so it has no use for this, and §4's
 * budget has 0.4KB left in it. Vanilla and dependency-free all the same, since
 * both a server builder and a client component import it.
 */

import type { MapTagGroup } from "@/lib/repositories/types";

/**
 * Every tag id at least one of these places wears.
 *
 * Ids only, never labels: `newTagId` mints an id that is not derived from what
 * the tag is called, precisely so two tags may share a label, and comparing the
 * words would fold them into one.
 */
export function wornTagIds(
  places: readonly { tags: readonly string[] }[],
): Set<string> {
  const worn = new Set<string>();

  for (const place of places) {
    for (const id of place.tags) worn.add(id);
  }

  return worn;
}

/**
 * The vocabulary narrowed to the tags in `keep`, with an emptied group dropped
 * whole — a heading over an empty row is worse than no heading.
 *
 * `keep` rather than the places themselves, because the two callers keep
 * different sets: the snapshot keeps what its *published* places wear, and the
 * filter menu keeps that plus whatever is currently selected, so a filter
 * already applied can still be switched off.
 *
 * Generic over the group, so a caller gets back the shape it passed in. The
 * snapshot narrows each tag to three fields afterwards; the dashboard wants its
 * own `MapTagGroup` untouched, and a hand-written copy here would quietly drop
 * any field either shape grows later.
 */
export function tagGroupsInUse<T extends MapTagGroup>(
  groups: readonly T[],
  keep: ReadonlySet<string>,
): T[] {
  return groups
    .map((group) => ({
      ...group,
      tags: group.tags.filter((tag) => keep.has(tag.id)),
    }))
    .filter((group) => group.tags.length > 0);
}
