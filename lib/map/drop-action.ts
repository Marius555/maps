import type { DraggedObject } from "@/components/groups/use-row-drag";

/**
 * What dropping one row on another means.
 *
 * It used to be four lines inside `LocationsList` — "in a group? join it.
 * otherwise, make one" — which was the whole rule while only a location or a
 * shape could be picked up. Groups can be dragged now, and the same drop has to
 * mean something different depending on what is in the hand, so there are seven
 * cases and they belong somewhere they can be read as a table and tested without
 * a map.
 *
 * The one idea underneath all of them: **dropping onto something means joining
 * whatever that something belongs to.** A row in a group means that group; a
 * group's header means that group; a loose row belongs to nothing, so one gets
 * made. Dragging a group is the same sentence with a bigger subject — its members
 * join the target, which empties it, and an empty group deletes itself
 * (components/groups/use-prune-empty-groups.ts). That is a merge, and it needs no
 * new endpoint.
 *
 * Returning `null` is a real answer and not an error: it is what makes a row the
 * pointer cannot use *stay dark* while a drag passes over it, rather than lighting
 * up and then doing nothing on release.
 */

/** The row underneath the pointer, reduced to what the decision needs. */
export type DropTargetRow =
  /** A group's header. `groupId` is the group's own id. */
  | { kind: "group"; groupId: string }
  /**
   * A location or a shape. `groupId` is the group it *resolves* to — "" for a
   * loose row, and "" as well for one naming a group that no longer exists. Same
   * rule `groupMembers` and `sidebarRows` follow, and for the same reason: a
   * deleted group's members are ungrouped the instant its row goes.
   */
  | { kind: "object"; object: DraggedObject; groupId: string };

export type DropOutcome =
  /** One object into an existing group. */
  | { kind: "join"; groupId: string; object: DraggedObject }
  /** Two loose objects: make a group holding both. */
  | { kind: "create"; objects: [DraggedObject, DraggedObject] }
  /** Everything in `sourceGroupId` moves into `targetGroupId`, which survives. */
  | { kind: "merge"; targetGroupId: string; sourceGroupId: string };

export function dropAction(
  dragged: DraggedObject,
  target: DropTargetRow,
  /**
   * The group the dragged object is currently in, or "". Only read for a location
   * or a shape — a group is not in anything, because groups do not nest.
   *
   * Resolved by the caller against the live list, so this module needs no view of
   * the map at all.
   */
  draggedGroupId: string,
): DropOutcome | null {
  /*
   * A route's stop is not a member of anything, so none of the seven cases
   * below can mean anything for one.
   *
   * Its membership is the route's own `stops` array and its position in that
   * array is the thing being dragged — a different gesture with a different
   * answer, handled by the two drop bands on each stop row
   * (components/map/routes/route-stop-list-item.tsx). Without this guard a
   * stop dropped on an ordinary row would fall through to `create` and make a
   * group out of a location and a row index.
   */
  if (dragged.type === "route-stop") return null;

  if (dragged.type === "group") return groupDroppedOn(dragged, target);

  // A row cannot be dropped on itself. That is a mis-drop, not a group of one.
  if (target.kind === "object" && isSame(target.object, dragged)) return null;

  if (target.groupId) {
    // Already in it. A PATCH assigning a place to the group it is in changes
    // nothing, and lighting the row up first would promise that it did.
    if (target.groupId === draggedGroupId) return null;

    return { kind: "join", groupId: target.groupId, object: dragged };
  }

  // A loose row has no group to join, so the drop makes one. This is the same
  // whether the dragged object was in a group before: it leaves, which is what
  // dropping it somewhere else means.
  if (target.kind !== "object") return null;

  return { kind: "create", objects: [target.object, dragged] };
}

/**
 * A whole group in the hand.
 *
 * Onto anything that belongs to another group, this is a merge — which is what
 * the Merge button under a marquee has always done, reached by the gesture people
 * try first. Onto a loose row it is the inverse and the only sensible reading:
 * the row joins the group, because the group is the thing with members.
 */
function groupDroppedOn(
  dragged: DraggedObject,
  target: DropTargetRow,
): DropOutcome | null {
  // Covers a group dropped on its own header *and* on any of its own members:
  // both resolve to the same id, and neither is a merge with anything.
  if (target.groupId === dragged.id) return null;

  if (target.groupId) {
    return {
      kind: "merge",
      targetGroupId: target.groupId,
      sourceGroupId: dragged.id,
    };
  }

  if (target.kind !== "object") return null;

  return { kind: "join", groupId: dragged.id, object: target.object };
}

function isSame(a: DraggedObject, b: DraggedObject): boolean {
  return a.type === b.type && a.id === b.id;
}
