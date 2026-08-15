import type { Group, Place, Shape } from "@/lib/repositories/types";

/**
 * What the button under a selection should do — and whether there is one.
 *
 * There used to be no question to answer: the button always made a new group and
 * moved the selection into it. That is right for two loose pins and wrong for
 * everything else. Clicking a group's row selects its members, so the bar
 * appeared over a group offering to group it, and pressing it built a second
 * group and emptied the first. Two groups selected together did the same thing
 * twice, leaving both originals behind at zero members.
 *
 * So the selection decides, by one rule: **if it already touches a group, that
 * group is where everything goes.** A new group is only made when nothing in the
 * selection has one, and nothing at all happens when the selection is exactly one
 * group — there is no such thing as grouping a group.
 *
 * Pure, so the four cases can be tested without a map or a query cache. The same
 * `groupId`-naming-a-missing-group rule `groupMembers` uses applies here, and for
 * the same reason: a deleted group's members are ungrouped the instant its row
 * goes, with no second round of writes.
 */

/** Just enough of a selection to decide. Ids, never objects — see editor-store. */
export type SelectedIds = {
  placeIds: readonly string[];
  shapeIds: readonly string[];
};

export type GroupActionKind =
  /** Nothing in the selection has a group. Make one. */
  | "create"
  /** One group plus loose objects. The loose ones join it. */
  | "join"
  /** Several groups. They collapse into the first. */
  | "merge";

export type GroupAction = {
  /** `null` when there is nothing worth doing, which hides the button. */
  kind: GroupActionKind | null;
  /** The group everything moves into, or `null` when one has to be created. */
  targetGroupId: string | null;
  /**
   * What actually has to be written. Objects already sitting in the target are
   * left out — assigning a place to the group it is already in is a PATCH that
   * changes nothing.
   */
  members: { placeIds: string[]; shapeIds: string[] };
};

const EMPTY: GroupAction = {
  kind: null,
  targetGroupId: null,
  members: { placeIds: [], shapeIds: [] },
};

export function groupAction(
  selection: SelectedIds,
  /** In the order the sidebar lists them — that is what picks the target. */
  groups: readonly Pick<Group, "id">[],
  places: readonly Pick<Place, "id" | "groupId">[],
  shapes: readonly Pick<Shape, "id" | "groupId">[],
): GroupAction {
  const realGroupIds = new Set(groups.map((group) => group.id));

  // Resolved once per selected object, so "which group is this in" is answered
  // in one place and the same way for places and shapes.
  const selectedPlaces = resolve(selection.placeIds, places, realGroupIds);
  const selectedShapes = resolve(selection.shapeIds, shapes, realGroupIds);
  const selected = [...selectedPlaces, ...selectedShapes];

  if (selected.length === 0) return EMPTY;

  const touched = new Set(
    selected.map((item) => item.groupId).filter((id) => id !== ""),
  );
  const hasLoose = selected.some((item) => item.groupId === "");

  // Sidebar order, not selection order: the target has to be predictable from
  // what is on screen, and the selection has no order a user can see.
  const targets = groups
    .filter((group) => touched.has(group.id))
    .map((group) => group.id);

  const kind = decide(targets.length, hasLoose);
  if (!kind) return { ...EMPTY, targetGroupId: targets[0] ?? null };

  const targetGroupId = kind === "create" ? null : (targets[0] ?? null);

  return {
    kind,
    targetGroupId,
    members: {
      placeIds: moving(selectedPlaces, targetGroupId),
      shapeIds: moving(selectedShapes, targetGroupId),
    },
  };
}

/** "Group" for both ways of filling one, "Merge" only when groups collapse. */
export function groupActionLabel(action: GroupAction): "Group" | "Merge" | null {
  if (!action.kind) return null;

  return action.kind === "merge" ? "Merge" : "Group";
}

function decide(groupCount: number, hasLoose: boolean): GroupActionKind | null {
  if (groupCount === 0) return "create";
  if (groupCount === 1) return hasLoose ? "join" : null;

  return "merge";
}

/**
 * Selected ids paired with the group each one actually resolves to.
 *
 * Ids that match nothing are dropped rather than carried through as members: a
 * selection can outlive the object it names — deleted in another tab, or removed
 * while its marquee highlight was still up — and a PATCH to a row that is gone is
 * a 404 in the middle of a gesture that otherwise worked.
 */
function resolve<T extends { id: string; groupId: string }>(
  ids: readonly string[],
  items: readonly T[],
  realGroupIds: ReadonlySet<string>,
): { id: string; groupId: string }[] {
  const byId = new Map(items.map((item) => [item.id, item]));

  return ids.flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];

    const groupId =
      item.groupId && realGroupIds.has(item.groupId) ? item.groupId : "";

    return [{ id, groupId }];
  });
}

function moving(
  items: readonly { id: string; groupId: string }[],
  targetGroupId: string | null,
): string[] {
  return items
    .filter((item) => item.groupId !== targetGroupId)
    .map((item) => item.id);
}
