import type { Map as MapLibreMap } from "maplibre-gl";
import { describe, expect, it } from "vitest";

import { DOT_IMAGE_ID } from "./dot-line";
import { blankMissingIcons } from "./missing-icons";
import { pinImageId } from "./pin-raster";

/**
 * Just the three methods the resolver touches, with an image table behind them
 * that behaves like MapLibre's: `addImage` on an id it already has is an error.
 */
function fakeMap() {
  const images = new Map<string, { width: number; height: number }>();
  let resolve: ((id: string) => void) | null = null;

  const map = {
    setMissingStyleImageResolver(fn: (id: string) => void) {
      resolve = fn;
      return map;
    },
    hasImage: (id: string) => images.has(id),
    addImage(id: string, image: { width: number; height: number }) {
      if (images.has(id)) throw new Error(`An image named "${id}" already exists.`);
      images.set(id, image);
      return map;
    },
  };

  blankMissingIcons(map as unknown as MapLibreMap);

  return {
    images,
    missing: (id: string) => resolve!(id),
  };
}

describe("blankMissingIcons", () => {
  it("fills a basemap icon the sprite lacks with a 1×1 blank", () => {
    const { images, missing } = fakeMap();

    missing("ice_rink");

    expect(images.get("ice_rink")).toMatchObject({ width: 1, height: 1 });
  });

  it("adds an id once, however many tiles ask for it", () => {
    const { images, missing } = fakeMap();

    missing("sports_centre");

    expect(() => missing("sports_centre")).not.toThrow();
    expect(images.size).toBe(1);
  });

  it("never blanks a pin, which would hide it for good", () => {
    // registerPinImages skips any id the map already has, so a blank under a
    // pin's id is a pin that can never be drawn.
    const { images, missing } = fakeMap();

    missing(pinImageId("star", "#e11d48"));

    expect(images.size).toBe(0);
  });

  it("never blanks the dotted-line image", () => {
    const { images, missing } = fakeMap();

    missing(DOT_IMAGE_ID);

    expect(images.size).toBe(0);
  });
});
