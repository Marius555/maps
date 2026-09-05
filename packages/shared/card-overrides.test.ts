import { describe, expect, it } from "vitest";

import {
  defaultCardLayout,
  type CardBlock,
  type CardLayout,
} from "./card-layout";
import {
  hasCardBlockOverrides,
  mergeCardBlocks,
  overrideBlock,
  type CardBlockOverrides,
} from "./card-overrides";

/**
 * How one location's card differs from the account's design.
 *
 * Worth testing where the card's rendering is not (§9 skips UI layout): the two
 * narrowing rules here are the whole of what stops a stale override drawing the
 * wrong block on a customer's site, and both are invisible until they fire. The
 * by-reference promise is tested too, because it is what keeps a map with no
 * overrides in it byte-for-byte the map it was.
 */

const layout: CardLayout = defaultCardLayout();

/** Whatever block the default card starts its middle zone with. */
const sample: CardBlock = layout.zones.middle[0];

function overrides(block: Partial<CardBlock>): CardBlockOverrides {
  return { [sample.id]: { ...sample, ...block } as CardBlock };
}

describe("overrideBlock", () => {
  it("returns the design's own block when there are no overrides", () => {
    expect(overrideBlock(sample, null)).toBe(sample);
    expect(overrideBlock(sample, undefined)).toBe(sample);
    expect(overrideBlock(sample, {})).toBe(sample);
  });

  it("substitutes the override when the id matches", () => {
    const result = overrideBlock(sample, overrides({ padding: 9 }));

    expect(result).not.toBe(sample);
    expect(result.padding).toBe(9);
  });

  it("ignores an override whose block the design no longer has", () => {
    const stale: CardBlockOverrides = {
      "block-that-was-deleted": { ...sample, id: "block-that-was-deleted" },
    };

    expect(overrideBlock(sample, stale)).toBe(sample);
  });

  /*
   * The guard that stops a recycled id inheriting a deleted block's settings.
   * Ids are unique within one card, not across a card's whole history.
   */
  it("ignores an override recorded against a different block type", () => {
    const mismatched: CardBlockOverrides = {
      [sample.id]: { ...sample, type: "divider" },
    };

    expect(overrideBlock(sample, mismatched)).toBe(sample);
  });
});

describe("mergeCardBlocks", () => {
  it("returns the layout itself when there is nothing to apply", () => {
    expect(mergeCardBlocks(layout, null)).toBe(layout);
  });

  it("replaces only the block named, leaving the rest of the card alone", () => {
    const merged = mergeCardBlocks(layout, overrides({ padding: 9 }));

    expect(merged.zones.middle[0].padding).toBe(9);
    // Every other block is the design's own object, not a copy of it.
    expect(merged.zones.middle.slice(1)).toEqual(layout.zones.middle.slice(1));
    expect(merged.zones.top).toEqual(layout.zones.top);
    expect(merged.zones.bottom).toEqual(layout.zones.bottom);
  });

  it("leaves the card's own settings untouched", () => {
    const merged = mergeCardBlocks(layout, overrides({ padding: 9 }));

    expect(merged.width).toBe(layout.width);
    expect(merged.radius).toBe(layout.radius);
    expect(merged.padding).toBe(layout.padding);
  });
});

describe("hasCardBlockOverrides", () => {
  it("is false for a location that has singled nothing out", () => {
    expect(hasCardBlockOverrides(null)).toBe(false);
    expect(hasCardBlockOverrides(undefined)).toBe(false);
    expect(hasCardBlockOverrides({})).toBe(false);
  });

  it("is true once one block is stored", () => {
    expect(hasCardBlockOverrides(overrides({ padding: 9 }))).toBe(true);
  });
});
