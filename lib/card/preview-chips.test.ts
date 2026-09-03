import { describe, expect, it } from "vitest";

import type { TagChip } from "@/packages/shared/tags";
import { previewChips } from "./preview-chips";

const REAL: TagChip[] = [
  { id: "t1", label: "Bikes", color: "#3d7ea6" },
  { id: "t2", label: "Repairs", color: "#a63d7e" },
];

describe("the designer's chip-count preview", () => {
  it("leaves the sample's own tags exactly alone", () => {
    // By reference, not merely equal: the untouched path is what every card
    // drawn before this control existed is drawn from, and it should cost
    // nothing at all.
    expect(previewChips(REAL, null)).toBe(REAL);
  });

  it("trims to the count, keeping the location's own order", () => {
    // The order is load-bearing well beyond tidiness: the first tag is what
    // colours the pin, so a trim that reordered would draw the sample card
    // against a colour the map does not use.
    expect(previewChips(REAL, 1)).toEqual([REAL[0]]);
  });

  it("pads past what the sample actually wears", () => {
    const chips = previewChips(REAL, 4);

    expect(chips).toHaveLength(4);
    // The real ones first and untouched, for the reason the trim keeps order.
    expect(chips[0]).toBe(REAL[0]);
    expect(chips[1]).toBe(REAL[1]);
  });

  it("gives the invented chips ids no tag can collide with", () => {
    const chips = previewChips(REAL, 4);

    for (const chip of chips.slice(REAL.length)) {
      expect(chip.id.startsWith("preview-")).toBe(true);
      // And no colour, so nothing downstream paints the sample pin a shade the
      // map has never heard of — `pinColorOfChips` walks past a chip with none.
      expect(chip.color).toBeUndefined();
    }
  });

  it("gives them labels of different lengths", () => {
    // The whole point of the control is checking how a row of chips *wraps*,
    // and six identical pills wrap where no real vocabulary would.
    const labels = previewChips([], 4).map((chip) => chip.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("never repeats a tag the location already wears", () => {
    // A bike shop that genuinely has a Ski hire tag was being shown two Ski hire
    // chips, which reads as a bug in the tag system rather than as a
    // placeholder — the opposite of what a preview is for.
    const shop: TagChip[] = [{ id: "t1", label: "Ski hire" }];
    const labels = previewChips(shop, 6).map((chip) => chip.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("matches what is already worn without minding the case", () => {
    const shop: TagChip[] = [{ id: "t1", label: "REPAIRS" }];
    const labels = previewChips(shop, 6).map((chip) => chip.label.toLowerCase());

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("numbers the extras once the stand-ins run out", () => {
    // Rather than cycling, which would start repeating — the thing above exists
    // to avoid.
    const labels = previewChips([], 9).map((chip) => chip.label);

    expect(new Set(labels).size).toBe(9);
  });

  it("pads a location with no tags at all", () => {
    // Which is the common case on a fresh map, and the one where the Tags block
    // otherwise previews as a single "No tags yet" chip.
    expect(previewChips([], 3)).toHaveLength(3);
  });

  it("returns the whole list when the count is larger than nothing is", () => {
    expect(previewChips(REAL, REAL.length)).toEqual(REAL);
  });
});
