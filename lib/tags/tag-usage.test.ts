import { describe, expect, it } from "vitest";

import type { MapTagGroup } from "@/lib/repositories/types";
import { tagGroupsInUse, wornTagIds } from "./tag-usage";

/**
 * A vocabulary that has outlived some of its locations, which is the ordinary
 * state of a map somebody has been editing — see the file's own docblock.
 */
const GROUPS: MapTagGroup[] = [
  {
    id: "sells",
    label: "Sells",
    tags: [
      { id: "bikes", label: "Bikes", color: "#1c7ed6" },
      { id: "skis", label: "Skis", color: "#e8590c" },
    ],
  },
  {
    id: "stale",
    label: "Stale",
    tags: [{ id: "scasc", label: "scasc", color: "#868e96" }],
  },
];

const places = (...tags: string[][]) => tags.map((list) => ({ tags: list }));

describe("wornTagIds", () => {
  it("collects every id, once", () => {
    expect(wornTagIds(places(["bikes", "skis"], ["bikes"]))).toEqual(
      new Set(["bikes", "skis"]),
    );
  });

  it("is empty for a map with no locations", () => {
    expect(wornTagIds([])).toEqual(new Set());
  });

  /*
   * A place may still be wearing a tag the map deleted — nothing sweeps those
   * off the rows (CLAUDE.md, "dangling ids are the normal state"). This answers
   * what the *places* wear; narrowing against the vocabulary is the other
   * function's job, and it drops the dangling id by not finding it.
   */
  it("reports ids the map no longer defines", () => {
    expect(wornTagIds(places(["deleted"]))).toEqual(new Set(["deleted"]));
  });
});

describe("tagGroupsInUse", () => {
  it("drops a tag nobody wears", () => {
    const [sells] = tagGroupsInUse(GROUPS, new Set(["bikes"]));

    expect(sells?.tags.map((tag) => tag.id)).toEqual(["bikes"]);
  });

  it("drops a group left with nothing, heading included", () => {
    expect(
      tagGroupsInUse(GROUPS, new Set(["bikes"])).map((group) => group.id),
    ).toEqual(["sells"]);
  });

  it("keeps a tag that is not worn but is asked for", () => {
    // The filter menu's case: a tag selected from the URL whose last wearer has
    // since been deleted still has to be on screen to be switched off.
    expect(
      tagGroupsInUse(GROUPS, new Set(["bikes", "scasc"])).map((group) => group.id),
    ).toEqual(["sells", "stale"]);
  });

  it("keeps the order the map put the groups and tags in", () => {
    const kept = tagGroupsInUse(GROUPS, new Set(["skis", "bikes", "scasc"]));

    expect(kept.map((group) => group.id)).toEqual(["sells", "stale"]);
    expect(kept[0]?.tags.map((tag) => tag.id)).toEqual(["bikes", "skis"]);
  });

  it("carries every field of the group it was given", () => {
    const [sells] = tagGroupsInUse(GROUPS, new Set(["bikes"]));

    expect(sells?.label).toBe("Sells");
    expect(sells?.tags[0]).toEqual({
      id: "bikes",
      label: "Bikes",
      color: "#1c7ed6",
    });
  });

  it("returns nothing for a map whose locations are all gone", () => {
    expect(tagGroupsInUse(GROUPS, new Set())).toEqual([]);
  });
});
