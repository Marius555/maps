import type { Group, Place, Shape } from "@/lib/repositories/types";

/**
 * Splitting the sidebar's lists into grouped and ungrouped.
 *
 * The one rule worth stating: **a `groupId` naming a group that is not in the
 * list reads as ungrouped.** Deleting a group deletes one row and leaves its
 * members pointing at nothing (see groups.repository.ts), so this is what puts
 * them back in the flat list — immediately, with no second round of writes to go
 * wrong, and identically for a row that arrives mid-refetch before its group
 * does.
 *
 * Pure, so it can be tested without a map or a query cache.
 */

export type Grouped<T> = {
  /** Group id → its members, in the order the source list had them. */
  byGroup: Map<string, T[]>;
  /** Everything whose group does not resolve. */
  ungrouped: T[];
};

export function groupMembers<T extends { groupId: string }>(
  items: readonly T[],
  groupIds: ReadonlySet<string>,
): Grouped<T> {
  const byGroup = new Map<string, T[]>();
  const ungrouped: T[] = [];

  for (const item of items) {
    if (!item.groupId || !groupIds.has(item.groupId)) {
      ungrouped.push(item);
      continue;
    }

    const existing = byGroup.get(item.groupId);
    if (existing) {
      existing.push(item);
    } else {
      byGroup.set(item.groupId, [item]);
    }
  }

  return { byGroup, ungrouped };
}

/** Everything a group holds, for framing it on the map or counting it. */
export function membersOf(
  group: Pick<Group, "id">,
  places: readonly Place[],
  shapes: readonly Shape[],
): { places: Place[]; shapes: Shape[] } {
  return {
    places: places.filter((place) => place.groupId === group.id),
    shapes: shapes.filter((shape) => shape.groupId === group.id),
  };
}
