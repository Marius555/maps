import { describe, expect, it } from "vitest";

import { boundsSpanM, metresInsideBounds, metresToBounds } from "./metres";
import type { Bounds } from "./metres";

/**
 * A box around a point in Vilnius, roughly 100m across and 100m tall. Written in
 * degrees rather than metres because that is the shape Photon reports, and the
 * conversion is the thing under test.
 */
const WEST = 25.28;
const EAST = 25.28 + 100 / (111_320 * Math.cos((54.69 * Math.PI) / 180));
const SOUTH = 54.69;
const NORTH = 54.69 + 100 / 111_320;

/** [west, north, east, south] — Photon's order. */
const BOX: Bounds = [WEST, NORTH, EAST, SOUTH];

const centre = { lng: (WEST + EAST) / 2, lat: (SOUTH + NORTH) / 2 };

describe("metresInsideBounds", () => {
  it("is zero for a point outside the box", () => {
    expect(metresInsideBounds({ lng: WEST - 0.001, lat: centre.lat }, BOX)).toBe(0);
    expect(metresInsideBounds({ lng: centre.lng, lat: NORTH + 0.001 }, BOX)).toBe(0);
  });

  it("is zero on the edge itself", () => {
    expect(metresInsideBounds({ lng: WEST, lat: centre.lat }, BOX)).toBe(0);
  });

  it("measures to the nearest edge, not the far one", () => {
    // A quarter of the way in from the west edge: 25m from it, 75m from the east.
    const point = { lng: WEST + (EAST - WEST) / 4, lat: centre.lat };

    expect(metresInsideBounds(point, BOX)).toBeCloseTo(25, 0);
  });

  it("takes the nearest of the two axes", () => {
    // Dead centre horizontally (50m from either side) but 10m up from the south
    // edge — the short way out is downwards.
    const point = { lng: centre.lng, lat: SOUTH + 10 / 111_320 };

    expect(metresInsideBounds(point, BOX)).toBeCloseTo(10, 0);
  });

  it("peaks at the centre", () => {
    expect(metresInsideBounds(centre, BOX)).toBeCloseTo(50, 0);
  });

  /*
   * The two functions answer opposite halves of one question, and every point
   * belongs to exactly one of them. A point that is both "20m outside" and "20m
   * inside" would mean one of them has its comparison backwards.
   */
  it("never overlaps with metresToBounds", () => {
    const points = [
      centre,
      { lng: WEST, lat: SOUTH },
      { lng: WEST - 0.002, lat: centre.lat },
      { lng: centre.lng, lat: NORTH + 0.002 },
    ];

    for (const point of points) {
      const inside = metresInsideBounds(point, BOX);
      const outside = metresToBounds(point, BOX);

      expect(Math.min(inside, outside)).toBe(0);
    }
  });
});

describe("boundsSpanM", () => {
  it("measures the diagonal of the box", () => {
    // 100m by 100m, so the diagonal is 100√2.
    expect(boundsSpanM(BOX)).toBeCloseTo(Math.hypot(100, 100), 0);
  });

  it("is zero for a degenerate box", () => {
    expect(boundsSpanM([WEST, SOUTH, WEST, SOUTH])).toBe(0);
  });

  /*
   * The case this exists for: an administrative polygon is orders of magnitude
   * larger than any building, and that is what a size test has to be able to see.
   */
  it("separates a building from a district", () => {
    const district: Bounds = [25.1, 54.8, 25.4, 54.6];

    expect(boundsSpanM(BOX)).toBeLessThan(200);
    expect(boundsSpanM(district)).toBeGreaterThan(20_000);
  });
});
