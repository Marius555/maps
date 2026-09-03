import { describe, expect, it } from "vitest";

import type { SnapshotTagGroup } from "./snapshot";
import { matchesTags, tagGroupIndex, tagLabelsOf } from "./tags";

/**
 * Two questions, because one group can never show the difference between AND
 * across groups and OR everywhere — which is the whole rule.
 */
const GROUPS: SnapshotTagGroup[] = [
  {
    id: "sells",
    label: "Sells",
    tags: [
      { id: "bikes", label: "Bikes" },
      { id: "skis", label: "Skis" },
    ],
  },
  {
    id: "open",
    label: "Open",
    tags: [{ id: "sundays", label: "Sundays" }],
  },
];

const groupOf = tagGroupIndex(GROUPS);

describe("tagGroupIndex", () => {
  it("maps every tag to the group it came from", () => {
    expect(groupOf.get("bikes")).toBe("sells");
    expect(groupOf.get("skis")).toBe("sells");
    expect(groupOf.get("sundays")).toBe("open");
  });

  it("has nothing to say about a tag no group lists", () => {
    expect(groupOf.get("deleted")).toBeUndefined();
  });
});

describe("matchesTags", () => {
  it("shows everything when nothing is selected", () => {
    // An empty filter is "no filter", not "no results".
    expect(matchesTags(["bikes"], new Set(), groupOf)).toBe(true);
    expect(matchesTags([], new Set(), groupOf)).toBe(true);
    expect(matchesTags(undefined, new Set(), groupOf)).toBe(true);
  });

  it("keeps a place wearing the one selected tag", () => {
    expect(matchesTags(["bikes"], new Set(["bikes"]), groupOf)).toBe(true);
  });

  it("drops a place wearing none of them", () => {
    expect(matchesTags(["skis"], new Set(["bikes"]), groupOf)).toBe(false);
    expect(matchesTags(undefined, new Set(["bikes"]), groupOf)).toBe(false);
  });

  it("widens within a group: a second tag in the same group adds results", () => {
    // The failure this guards is AND-everywhere, where ticking a second product
    // line returns fewer shops rather than more — which reads as a broken filter.
    const selected = new Set(["bikes", "skis"]);

    expect(matchesTags(["bikes"], selected, groupOf)).toBe(true);
    expect(matchesTags(["skis"], selected, groupOf)).toBe(true);
  });

  it("narrows across groups: every answered group has to match", () => {
    // The mirror failure, OR-everywhere, where the opening-hours question stops
    // narrowing anything at all once a product is ticked.
    const selected = new Set(["bikes", "sundays"]);

    expect(matchesTags(["bikes", "sundays"], selected, groupOf)).toBe(true);
    expect(matchesTags(["bikes"], selected, groupOf)).toBe(false);
    expect(matchesTags(["sundays"], selected, groupOf)).toBe(false);
  });

  it("combines both at once", () => {
    // "Sells bikes OR skis, AND opens Sundays" — the shape of a real search.
    const selected = new Set(["bikes", "skis", "sundays"]);

    expect(matchesTags(["skis", "sundays"], selected, groupOf)).toBe(true);
    expect(matchesTags(["bikes", "sundays"], selected, groupOf)).toBe(true);
    expect(matchesTags(["bikes", "skis"], selected, groupOf)).toBe(false);
    expect(matchesTags(["sundays"], selected, groupOf)).toBe(false);
  });

  it("ignores tags the place wears that nobody selected", () => {
    expect(matchesTags(["bikes", "skis", "sundays"], new Set(["bikes"]), groupOf)).toBe(
      true,
    );
  });

  it("treats a selected tag with no known group as its own question", () => {
    // Not skipped: skipping would silently widen the filter, so a selection the
    // index cannot explain shows as "nothing matches" rather than "everything".
    expect(matchesTags(["bikes"], new Set(["ghost"]), groupOf)).toBe(false);
    expect(matchesTags(["ghost"], new Set(["ghost"]), groupOf)).toBe(true);
  });
});

describe("tagLabelsOf", () => {
  it("turns the ids a place wears into the map's own labels", () => {
    expect(tagLabelsOf(GROUPS, ["bikes", "sundays"])).toEqual([
      "Bikes",
      "Sundays",
    ]);
  });

  it("drops an id the map no longer defines", () => {
    /*
     * The case that makes this a shared function rather than a `map` at each
     * call site. Nothing sweeps a deleted tag off the places wearing it, so a
     * dangling id is the normal state — and rendering one as itself would put
     * `tag-3f9a1c04` on a card on a customer's site.
     */
    expect(tagLabelsOf(GROUPS, ["bikes", "tag-3f9a1c04"])).toEqual(["Bikes"]);
    expect(tagLabelsOf(GROUPS, ["tag-3f9a1c04"])).toEqual([]);
  });

  it("answers in the map's order, not the row's", () => {
    // The ids come off an Appwrite array column in whatever order they were
    // written. The chips should read in the order the owner arranged the
    // filters, so two locations wearing the same tags list them the same way.
    expect(tagLabelsOf(GROUPS, ["sundays", "skis", "bikes"])).toEqual([
      "Bikes",
      "Skis",
      "Sundays",
    ]);
  });

  it("says nothing for a location with no tags", () => {
    expect(tagLabelsOf(GROUPS, [])).toEqual([]);
    expect(tagLabelsOf(GROUPS, undefined)).toEqual([]);
    expect(tagLabelsOf([], ["bikes"])).toEqual([]);
  });
});
