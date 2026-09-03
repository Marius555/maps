import { describe, expect, it } from "vitest";

import { PALETTE_COLORS } from "@/lib/validation/palette";
import { MAX_TAGS_TOTAL, MAX_TAG_GROUPS } from "@/lib/validation/tag.schema";
import { IMPORTED_TAG_GROUP_LABEL, resolveTags, splitTagCell } from "./resolve-tags";

describe("splitTagCell", () => {
  it("splits on comma, semicolon and pipe", () => {
    // All three, because real exports use all three and the file is not ours.
    expect(splitTagCell("Bikes, Skis")).toEqual(["Bikes", "Skis"]);
    expect(splitTagCell("Bikes; Skis")).toEqual(["Bikes", "Skis"]);
    expect(splitTagCell("Bikes|Skis")).toEqual(["Bikes", "Skis"]);
    expect(splitTagCell("Bikes,Skis; Repairs|Hire")).toEqual([
      "Bikes",
      "Skis",
      "Repairs",
      "Hire",
    ]);
  });

  it("drops blanks and repeats within one cell", () => {
    expect(splitTagCell("Bikes, ,bikes,  BIKES ")).toEqual(["Bikes"]);
    expect(splitTagCell("")).toEqual([]);
    expect(splitTagCell("  ,  ")).toEqual([]);
  });
});

describe("resolveTags", () => {
  const existing = [
    {
      id: "grp-1",
      label: "Sells",
      tags: [{ id: "tag-bikes", label: "Bikes", color: PALETTE_COLORS[0] }],
    },
  ];

  it("matches an existing tag case-insensitively instead of creating a second", () => {
    const resolved = resolveTags(["bikes"], existing);

    expect(resolved.idByLabel.get("bikes")).toBe("tag-bikes");
    expect(resolved.addedCount).toBe(0);
    expect(resolved.tagGroups).toEqual(existing);
  });

  it("creates unknown tags in a group of their own", () => {
    const resolved = resolveTags(["Bikes", "Skis"], existing);

    expect(resolved.addedCount).toBe(1);
    expect(resolved.tagGroups).toHaveLength(2);

    const added = resolved.tagGroups[1];
    expect(added.label).toBe(IMPORTED_TAG_GROUP_LABEL);
    expect(added.tags.map((tag) => tag.label)).toEqual(["Skis"]);
    // Existing ones stay where their owner put them.
    expect(resolved.idByLabel.get("bikes")).toBe("tag-bikes");
  });

  it("adds to the import group when the map already has one", () => {
    const withGroup = [
      ...existing,
      { id: "grp-2", label: IMPORTED_TAG_GROUP_LABEL, tags: [] },
    ];

    const resolved = resolveTags(["Skis"], withGroup);

    expect(resolved.tagGroups).toHaveLength(2);
    expect(resolved.tagGroups[1].tags.map((tag) => tag.label)).toEqual(["Skis"]);
  });

  it("gives new tags colours the group is not already wearing", () => {
    // A location's first tag colours its pin, so a column of product lines that
    // imported as six of the same colour is a map with nothing to read.
    const resolved = resolveTags(["Skis", "Repairs", "Hire"], []);

    const colors = resolved.tagGroups[0].tags.map((tag) => tag.color);

    expect(new Set(colors).size).toBe(3);
    const palette: readonly string[] = PALETTE_COLORS;
    expect(colors.every((color) => palette.includes(color))).toBe(true);
  });

  it("does not reuse a colour the target group already has", () => {
    const resolved = resolveTags(["Skis"], existing);

    expect(resolved.tagGroups[1].tags[0].color).not.toBe(
      existing[0].tags[0].color,
    );
  });

  it("never reuses an id", () => {
    // The whole reason these are random rather than slugs: nothing sweeps a
    // deleted tag off the places wearing it, so "Bikes" deleted and re-imported
    // must not come back attached to locations nobody tagged.
    const first = resolveTags(["Skis"], existing);
    const second = resolveTags(["Skis"], existing);

    expect(first.idByLabel.get("skis")).not.toBe(second.idByLabel.get("skis"));
  });

  it("reports labels it could not fit rather than dropping them silently", () => {
    const full = [
      {
        id: "grp-1",
        label: IMPORTED_TAG_GROUP_LABEL,
        tags: Array.from({ length: MAX_TAGS_TOTAL }, (_, index) => ({
          id: `tag-${index}`,
          label: `Tag ${index}`,
          color: PALETTE_COLORS[index % PALETTE_COLORS.length],
        })),
      },
    ];

    const resolved = resolveTags(["Something new"], full);

    expect(resolved.addedCount).toBe(0);
    expect(resolved.dropped).toEqual(["Something new"]);
  });

  it("reports labels it cannot fit when there is no room for another group", () => {
    const full = Array.from({ length: MAX_TAG_GROUPS }, (_, index) => ({
      id: `grp-${index}`,
      label: `Group ${index}`,
      tags: [],
    }));

    const resolved = resolveTags(["Skis"], full);

    expect(resolved.tagGroups).toHaveLength(MAX_TAG_GROUPS);
    expect(resolved.dropped).toEqual(["Skis"]);
  });

  it("leaves the caller's groups untouched", () => {
    // The wizard resolves before it writes anything, and a failed import must
    // not have quietly mutated the map it was reading from.
    const resolved = resolveTags(["Skis"], existing);

    expect(existing[0].tags).toHaveLength(1);
    expect(resolved.tagGroups[0]).not.toBe(existing[0]);
  });
});
