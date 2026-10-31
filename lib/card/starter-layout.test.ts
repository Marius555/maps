import { describe, expect, it } from "vitest";

import {
  BLOCK_MARGIN,
  BLOCK_PADDING,
  BUTTON_ROOM,
  CARD_HEIGHTS,
  CARD_WIDTHS,
  RADIUS_STOPS,
  heightStops,
} from "@/components/card/designer/properties/property-scales";
import { isDefaultCardLayout } from "@/lib/validation/card-layout.schema";
import {
  CARD_BLOCKS,
  CARD_ZONES,
  emptyCardLayout,
  resolveCardLayout,
} from "@/packages/shared/card-layout";

import { effectiveCardLayout } from "./designer-status";
import { starterCardLayout } from "./starter-layout";

const tile = (options: readonly { value: number; label: string }[], label: string) =>
  options.find((option) => option.label === label)?.value;

describe("starterCardLayout", () => {
  const starter = starterCardLayout();

  it("is already canonical, so the designer does not see it as edited", () => {
    expect(resolveCardLayout(starter)).toEqual(starter);
  });

  it("holds exactly the four blocks, each in a zone its spec allows", () => {
    expect(
      CARD_ZONES.map((zone) => starter.zones[zone].map((block) => block.type)),
    ).toEqual([["gallery", "logo"], ["address"], ["button"]]);

    for (const zone of CARD_ZONES) {
      for (const block of starter.zones[zone]) {
        expect(CARD_BLOCKS[block.type].zones).toContain(zone);
        // No stored free space: only the standard drop targets.
        expect(block.offset).toBeUndefined();
      }
    }
  });

  it("is built from the designer's own tiles", () => {
    expect(starter.width).toBe(tile(CARD_WIDTHS, "XS"));
    expect(starter.maxHeight).toBe(tile(CARD_HEIGHTS, "S"));

    const [gallery, logo] = starter.zones.top;
    expect(gallery.heightPct).toBe(33);
    expect(logo.heightPct).toBe(
      tile(heightStops(CARD_BLOCKS.logo.defaultHeightPct!, CARD_BLOCKS.logo.maxHeightPct!), "L"),
    );
    expect(logo.align).toBe("end");
    expect(logo.overlapPct).toBe(50);

    const [button] = starter.zones.bottom;
    expect(button.buttonRadius).toBe(tile(RADIUS_STOPS, "Pill"));
    expect(button.buttonPadding).toBe(tile(BUTTON_ROOM, "Regular"));
    expect(button.buttonFull).toBe(true);
    // Spacing → Margin: None, Padding: Tight.
    expect(button.margin).toBe(tile(BLOCK_MARGIN, "None"));
    expect(button.padding).toBe(tile(BLOCK_PADDING, "Tight"));
  });

  it("is not the embed's own default, so a publish writes it out", () => {
    expect(isDefaultCardLayout(starter)).toBe(false);
  });
});

describe("effectiveCardLayout", () => {
  it("draws the starter for an account that never saved a design", () => {
    expect(effectiveCardLayout(null)).toEqual(starterCardLayout());
    expect(effectiveCardLayout(undefined)).toEqual(starterCardLayout());
    expect(effectiveCardLayout({})).toEqual(starterCardLayout());
  });

  it("keeps a deliberately cleared card empty", () => {
    const cleared = emptyCardLayout();
    expect(effectiveCardLayout(cleared as unknown as Record<string, unknown>)).toEqual(
      resolveCardLayout(cleared),
    );
  });

  it("reads a saved design as stored", () => {
    const saved = { ...emptyCardLayout(), width: 360 };
    saved.zones.middle = [{ id: "name", type: "name" }];
    expect(
      effectiveCardLayout(saved as unknown as Record<string, unknown>).zones.middle,
    ).toEqual([{ id: "name", type: "name" }]);
  });
});
