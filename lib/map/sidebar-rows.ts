import type { Group, Place, Shape } from "@/lib/repositories/types";
import { groupMembers } from "./group-members";

/**
 * The Locations panel as one flat run of rows.
 *
 * It used to be three nested lists — a Groups section whose every group rendered
 * its own `PlaceList` and `ShapeList`, then a loose `PlaceList` and a loose
 * `ShapeList` beside it. Which meant a location's row lived in a *different
 * component tree* depending on whether it was in a group, so changing its
 * `groupId` was an unmount over here and a mount over there. On screen that read
 * as the row flashing out of the group and reappearing somewhere else, because
 * that is literally what happened: two elements, no relationship between them.
 *
 * Flattening is what makes the move animatable. One `<ul>`, one
 * `AnimatePresence`, and a row keyed by its object id — so joining or leaving a
 * group is a *reorder* of a list the row never left, which Motion's `layout`
 * prop animates as a slide. It also ends the duplicate: deleting a group used to
 * render its members twice for the length of the exit, once inside the block on
 * its way out and once in the loose list they had already fallen into.
 *
 * Pure, so the ordering can be tested without a map or a query cache.
 */

/** Group ids and object ids come from different tables, so keys are prefixed. */
export type SidebarRow =
  | { kind: "heading"; key: "heading:groups" }
  | {
      kind: "group";
      key: string;
      group: Group;
      /**
       * What it holds, in list order — carried on the row because the header
       * needs both the count and the answer to "is every member selected?", and
       * the partition that knows has already been done by the time this is built.
       */
      places: Place[];
      shapes: Shape[];
      isOpen: boolean;
    }
  | {
      kind: "place";
      key: string;
      place: Place;
      /** The group it resolves to, or "" — which is what a drop on it means. */
      groupId: string;
      /** Set only inside a group: what its pin is actually painted on the map. */
      groupColor?: string;
      indent: boolean;
      startsLooseSection: boolean;
    }
  | {
      kind: "shape";
      key: string;
      shape: Shape;
      groupId: string;
      groupColor?: string;
      indent: boolean;
      startsLooseSection: boolean;
    };

export function sidebarRows({
  groups,
  places,
  shapes,
  collapsed,
  hideEmptyGroups,
}: {
  groups: readonly Group[];
  places: readonly Place[];
  shapes: readonly Shape[];
  /** Group ids the user has folded shut. Their members are left out entirely. */
  collapsed: ReadonlySet<string>;
  /**
   * Leave out groups with nothing in them.
   *
   * True only while one is being created and filled. Making a group is a create
   * followed by a `groupId` PATCH per member, so it legitimately exists empty for
   * about a third of a second — rendered, that is a "Group 1 — 0" that appears
   * and is replaced twice in the space of one gesture. Outside that window
   * nothing is hidden, because an empty group deletes itself
   * (`use-prune-empty-groups.ts`).
   */
  hideEmptyGroups: boolean;
}): SidebarRow[] {
  const groupIds = new Set(groups.map((group) => group.id));

  // The one rule the whole panel rests on lives in here: a `groupId` naming a
  // group that is not in the list reads as ungrouped, which is what puts a
  // deleted group's members back in the loose run with no second round of writes.
  const groupedPlaces = groupMembers(places, groupIds);
  const groupedShapes = groupMembers(shapes, groupIds);

  const rows: SidebarRow[] = [];

  const visibleGroups = groups.filter((group) => {
    if (!hideEmptyGroups) return true;

    const count =
      (groupedPlaces.byGroup.get(group.id)?.length ?? 0) +
      (groupedShapes.byGroup.get(group.id)?.length ?? 0);

    return count > 0;
  });

  // Groups first, because a group is a heading for the things below it and a
  // heading underneath its contents is not a heading.
  if (visibleGroups.length > 0) rows.push({ kind: "heading", key: "heading:groups" });

  for (const group of visibleGroups) {
    const groupPlaces = groupedPlaces.byGroup.get(group.id) ?? [];
    const groupShapes = groupedShapes.byGroup.get(group.id) ?? [];
    const isOpen = !collapsed.has(group.id);

    rows.push({
      kind: "group",
      key: `group:${group.id}`,
      group,
      places: groupPlaces,
      shapes: groupShapes,
      isOpen,
    });

    if (!isOpen) continue;

    for (const place of groupPlaces) {
      rows.push({
        kind: "place",
        key: `place:${place.id}`,
        place,
        groupId: group.id,
        groupColor: group.color,
        indent: true,
        startsLooseSection: false,
      });
    }

    for (const shape of groupShapes) {
      rows.push({
        kind: "shape",
        key: `shape:${shape.id}`,
        shape,
        groupId: group.id,
        groupColor: group.color,
        indent: true,
        startsLooseSection: false,
      });
    }
  }

  /*
   * Everything loose, locations and shapes in one run.
   *
   * Shapes have no heading of their own: a shape's swatch is a circle where a
   * location's is a dot, and its second line reads "Circle · 2.4 km radius", so
   * the heading was labelling something that already had a label — on the panel
   * where vertical space is scarcest.
   *
   * The first of them carries the rule that used to be the Groups section's
   * bottom border. As a flag on a row rather than a wrapper, because a wrapper is
   * exactly the nesting this file exists to remove.
   */
  let isFirstLoose = rows.length > 0;

  for (const place of groupedPlaces.ungrouped) {
    rows.push({
      kind: "place",
      key: `place:${place.id}`,
      place,
      // Not `place.groupId`: a member of a group that has been deleted still
      // names it, and everything here reads that as no group at all.
      groupId: "",
      indent: false,
      startsLooseSection: isFirstLoose,
    });
    isFirstLoose = false;
  }

  for (const shape of groupedShapes.ungrouped) {
    rows.push({
      kind: "shape",
      key: `shape:${shape.id}`,
      shape,
      groupId: "",
      indent: false,
      startsLooseSection: isFirstLoose,
    });
    isFirstLoose = false;
  }

  return rows;
}
