import { describe, expect, it } from "vitest";

import { groupMembers } from "./group-members";

const rows = [
  { id: "a", groupId: "g1" },
  { id: "b", groupId: "" },
  { id: "c", groupId: "g2" },
  { id: "d", groupId: "g1" },
];

describe("groupMembers", () => {
  it("splits members from loose rows", () => {
    const { byGroup, ungrouped } = groupMembers(rows, new Set(["g1", "g2"]));

    expect(byGroup.get("g1")?.map((row) => row.id)).toEqual(["a", "d"]);
    expect(byGroup.get("g2")?.map((row) => row.id)).toEqual(["c"]);
    expect(ungrouped.map((row) => row.id)).toEqual(["b"]);
  });

  it("keeps the source order inside a group", () => {
    const reversed = [...rows].reverse();
    const { byGroup } = groupMembers(reversed, new Set(["g1"]));

    expect(byGroup.get("g1")?.map((row) => row.id)).toEqual(["d", "a"]);
  });

  it("treats a groupId with no group as ungrouped", () => {
    // What a deleted group leaves behind: the members keep the id, and nothing
    // cleans it up. They have to come back to the flat list on their own.
    const { byGroup, ungrouped } = groupMembers(rows, new Set(["g2"]));

    expect(byGroup.has("g1")).toBe(false);
    expect(ungrouped.map((row) => row.id)).toEqual(["a", "b", "d"]);
  });

  it("puts everything loose when there are no groups at all", () => {
    const { byGroup, ungrouped } = groupMembers(rows, new Set());

    expect(byGroup.size).toBe(0);
    expect(ungrouped).toHaveLength(4);
  });
});
