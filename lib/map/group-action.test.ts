import { describe, expect, it } from "vitest";

import { groupAction, groupActionLabel } from "./group-action";

const groups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];

const places = [
  { id: "p1", groupId: "g1" },
  { id: "p2", groupId: "g1" },
  { id: "p3", groupId: "g2" },
  { id: "loose1", groupId: "" },
  { id: "loose2", groupId: "" },
  { id: "orphan", groupId: "gone" },
];

const shapes = [
  { id: "s1", groupId: "g1" },
  { id: "s2", groupId: "g3" },
  { id: "looseShape", groupId: "" },
];

const select = (placeIds: string[], shapeIds: string[] = []) =>
  groupAction({ placeIds, shapeIds }, groups, places, shapes);

describe("groupAction", () => {
  it("makes a new group when nothing selected has one", () => {
    const action = select(["loose1", "loose2"]);

    expect(action.kind).toBe("create");
    expect(action.targetGroupId).toBeNull();
    expect(action.members.placeIds).toEqual(["loose1", "loose2"]);
    expect(groupActionLabel(action)).toBe("Group");
  });

  it("does nothing when the selection is exactly one group", () => {
    // The bug this whole module exists for: clicking a group's row selects its
    // members, and the button used to offer to group them into a second group.
    const action = select(["p1", "p2"], ["s1"]);

    expect(action.kind).toBeNull();
    expect(groupActionLabel(action)).toBeNull();
    expect(action.members.placeIds).toEqual([]);
    expect(action.members.shapeIds).toEqual([]);
  });

  it("joins loose objects to the one group in the selection", () => {
    const action = select(["p1", "p2", "loose1"], ["s1"]);

    expect(action.kind).toBe("join");
    expect(action.targetGroupId).toBe("g1");
    expect(groupActionLabel(action)).toBe("Group");
  });

  it("leaves out members already in the target", () => {
    const action = select(["p1", "p2", "loose1"], ["s1", "looseShape"]);

    expect(action.members.placeIds).toEqual(["loose1"]);
    expect(action.members.shapeIds).toEqual(["looseShape"]);
  });

  it("merges several groups into the first one in sidebar order", () => {
    const action = select(["p3", "p1"]);

    expect(action.kind).toBe("merge");
    expect(action.targetGroupId).toBe("g1");
    expect(groupActionLabel(action)).toBe("Merge");
    // p1 is already in g1, so only p3 is written.
    expect(action.members.placeIds).toEqual(["p3"]);
  });

  it("picks the target by sidebar order, not selection order", () => {
    // Selecting g3's shape first must still merge into g2, because g2 is listed
    // above g3. Anything else makes the outcome unguessable from the screen.
    const action = groupAction(
      { placeIds: ["p3"], shapeIds: ["s2"] },
      groups,
      places,
      shapes,
    );

    expect(action.targetGroupId).toBe("g2");
    expect(action.members.shapeIds).toEqual(["s2"]);
    expect(action.members.placeIds).toEqual([]);
  });

  it("merges groups together with loose objects in one go", () => {
    const action = select(["p1", "p3", "loose1"]);

    expect(action.kind).toBe("merge");
    expect(action.targetGroupId).toBe("g1");
    expect(action.members.placeIds).toEqual(["p3", "loose1"]);
  });

  it("treats a groupId naming a missing group as loose", () => {
    // Same rule as groupMembers: a deleted group's members are ungrouped the
    // instant its row goes, with no write to make it true.
    const action = select(["orphan", "loose1"]);

    expect(action.kind).toBe("create");
    expect(action.members.placeIds).toEqual(["orphan", "loose1"]);
  });

  it("ignores ids that no longer exist", () => {
    // A marquee highlight can outlive the object it caught. PATCHing a deleted
    // row would 404 in the middle of a gesture that otherwise worked.
    const action = select(["loose1", "deleted"]);

    expect(action.members.placeIds).toEqual(["loose1"]);
  });

  it("does nothing with an empty selection", () => {
    const action = select([]);

    expect(action.kind).toBeNull();
    expect(action.targetGroupId).toBeNull();
  });

  it("still groups a single loose object", () => {
    // A group of one is a real thing to want — it is a named bucket to drag more
    // into. Only a selection that is *already* one group has nothing to do.
    const action = select(["loose1"]);

    expect(action.kind).toBe("create");
    expect(action.members.placeIds).toEqual(["loose1"]);
  });
});
