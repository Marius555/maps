import { describe, expect, it } from "vitest";

import { UNTAGGED_PIN_COLOR } from "@/packages/shared/pin-icons";
import type { MapSnapshot, SnapshotPlace } from "@/packages/shared/snapshot";

import { colorOf, colorsOf } from "./map";

/**
 * What an untagged pin is drawn in, and the §7 half of that question.
 *
 * The editor draws such a pin in `var(--accent)` and a published map used to
 * have no way to know what that was, so it drew a flat grey — the Publish tab
 * showing a different map from the editor next door. A snapshot now carries the
 * answer, and the thing that must not regress is what happens when it does
 * *not*: every file already on a customer's site was written without this field
 * and has to keep rendering exactly the grey it always did.
 */
const PLACE: SnapshotPlace = { id: "p1", name: "One", lat: 0, lng: 0 };

function snapshotWith(settings: Partial<MapSnapshot["settings"]>): MapSnapshot {
  return {
    settings: { clustering: true, search: true, nearest: true, ...settings },
  } as MapSnapshot;
}

describe("colorOf", () => {
  it("draws an untagged pin in the colour the snapshot published", () => {
    const colors = colorsOf(snapshotWith({ pinColor: "#f54600" }));

    expect(colorOf(PLACE, colors)).toBe("#f54600");
  });

  it("keeps the flat grey on a snapshot written before the field existed", () => {
    const colors = colorsOf(snapshotWith({}));

    expect(colorOf(PLACE, colors)).toBe(UNTAGGED_PIN_COLOR);
  });

  it("still lets a tag out-rank the published default", () => {
    // The whole point of the ladder: the published colour answers for a place
    // the map says nothing about, and never over the top of one it does.
    const snapshot = snapshotWith({ pinColor: "#f54600" });
    const colors = colorsOf({
      ...snapshot,
      tagGroups: [
        { id: "g1", label: "Kind", tags: [{ id: "t1", label: "Shop", color: "#00aa88" }] },
      ],
    } as MapSnapshot);

    expect(colorOf({ ...PLACE, tags: ["t1"] }, colors)).toBe("#00aa88");
  });

  it("still lets a pre-merge category out-rank it", () => {
    // The legacy vocabulary is read *above* this for the reason it is read at
    // all: a file carrying categories predates the pin colour too, so the
    // colour it already draws has to keep winning.
    const colors = colorsOf({
      ...snapshotWith({ pinColor: "#f54600" }),
      categories: [{ id: "c1", label: "Retail", color: "#3355ff" }],
    } as MapSnapshot);

    expect(colorOf({ ...PLACE, category: "c1" }, colors)).toBe("#3355ff");
  });
});
