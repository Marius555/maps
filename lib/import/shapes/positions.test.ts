import { describe, expect, it } from "vitest";

import {
  decideAxis,
  detectProjection,
  harvestRings,
  isBarePosition,
  isClosed,
  openRing,
  readPosition,
  toLngLat,
  unprojectMercator,
  type RawRing,
} from "./positions";

/** A ring of bare pairs, the way a file writes them. */
function ring(...pairs: [number, number][]): RawRing {
  return pairs.map(([a, b]) => ({ a, b, fixed: false }));
}

describe("readPosition", () => {
  it("reads a bare pair and ignores a third component", () => {
    expect(readPosition([1, 2, 300])).toEqual({ a: 1, b: 2, fixed: false });
  });

  it("refuses anything that is not two finite numbers", () => {
    expect(readPosition([1])).toBeNull();
    expect(readPosition(["1", "2"])).toBeNull();
    expect(readPosition([Number.NaN, 2])).toBeNull();
    expect(readPosition(null)).toBeNull();
  });

  it.each([
    ["lat/lng", { lat: 40.7, lng: -73.9 }],
    ["lat/lon", { lat: 40.7, lon: -73.9 }],
    ["latitude/longitude", { latitude: 40.7, longitude: -73.9 }],
    ["y/x", { y: 40.7, x: -73.9 }],
  ])("reads a named position, %s, already in order", (_label, value) => {
    expect(readPosition(value)).toEqual({ a: -73.9, b: 40.7, fixed: true });
  });
});

describe("isBarePosition", () => {
  it("accepts a position and a position with an altitude", () => {
    expect(isBarePosition({ lat: 1, lng: 2 })).toBe(true);
    expect(isBarePosition({ lat: 1, lng: 2, alt: 30 })).toBe(true);
  });

  it("refuses a location", () => {
    // Three keys, exactly like `{ lat, lng, alt }` — which is why this is
    // decided by the names and not by counting them.
    expect(isBarePosition({ name: "Shop", lat: 1, lng: 2 })).toBe(false);
  });
});

describe("harvestRings", () => {
  it("measures the depth it found positions at", () => {
    expect(harvestRings([0, 1])?.depth).toBe(1);
    expect(harvestRings([[0, 1], [2, 3]])?.depth).toBe(2);
    expect(harvestRings([[[0, 1], [2, 3]]])?.depth).toBe(3);
    expect(harvestRings([[[[0, 1], [2, 3]]]])?.depth).toBe(4);
  });

  it("keeps rings apart above one level and joins positions at it", () => {
    const two = harvestRings([
      [[0, 0], [1, 1]],
      [[5, 5], [6, 6]],
    ]);

    expect(two?.rings).toHaveLength(2);
    expect(harvestRings([[0, 0], [1, 1]])?.rings).toHaveLength(1);
  });

  it("stops at its node budget rather than walking a hostile file forever", () => {
    const budget = { nodes: 3 };
    harvestRings([[0, 0], [1, 1], [2, 2], [3, 3]], budget);

    expect(budget.nodes).toBeLessThan(0);
  });

  it("returns null for anything with no positions in it", () => {
    expect(harvestRings([])).toBeNull();
    expect(harvestRings({ a: 1 })).toBeNull();
    expect(harvestRings(["a", "b"])).toBeNull();
  });
});

describe("decideAxis", () => {
  it("takes a longitude past ±90 as proof of the spec order", () => {
    expect(decideAxis([ring([139.7, 35.6])])).toEqual({
      axis: "lnglat",
      ambiguous: false,
    });
  });

  it("takes one in the second slot as proof of the other", () => {
    expect(decideAxis([ring([35.6, 139.7])])).toEqual({
      axis: "latlng",
      ambiguous: false,
    });
  });

  it("says it guessed when every value fits either order", () => {
    expect(decideAxis([ring([1, 2], [3, 4])])).toEqual({
      axis: "lnglat",
      ambiguous: true,
    });
  });

  it("takes a declared format as the answer instead of guessing", () => {
    expect(decideAxis([ring([1, 2])], { spec: true })).toEqual({
      axis: "lnglat",
      ambiguous: false,
    });
  });

  it("lets the caller override everything", () => {
    expect(decideAxis([ring([139.7, 35.6])], { forced: "latlng" })).toEqual({
      axis: "latlng",
      ambiguous: false,
    });
  });

  it("ignores values past ±180, which are not degrees in either order", () => {
    // Left in, a file of metres would prove both orders at once.
    expect(decideAxis([ring([-8235000, 4975000])])).toEqual({
      axis: "lnglat",
      ambiguous: true,
    });
  });
});

describe("detectProjection", () => {
  it("calls ordinary degrees what they are", () => {
    expect(detectProjection([ring([-73.9, 40.7], [-73.8, 40.8])])).toBe("wgs84");
  });

  it("recognises a file of Web Mercator metres", () => {
    expect(detectProjection([ring([-8235000, 4975000], [-8230000, 4980000])])).toBe(
      "webmercator",
    );
  });

  it("treats a single wild vertex as a typo, not a projection", () => {
    // Otherwise one `[999, 999]` moves every shape in the file to null island.
    const mixed = ring([0, 0], [1, 0], [999, 999], [1, 1], [0, 1]);

    expect(detectProjection([mixed])).toBe("wgs84");
  });

  it("refuses a grid it cannot convert", () => {
    // A national grid: far outside degrees, far inside Mercator's own bounds is
    // not enough — these are past them.
    expect(detectProjection([ring([53000000, 18000000])])).toBeNull();
  });
});

describe("unprojectMercator", () => {
  it("inverts the projection at the origin and at a known point", () => {
    expect(unprojectMercator(0, 0)).toEqual([0, 0]);

    // Checked against the textbook form written out longhand — x / R in radians
    // and 2·atan(e^(y/R)) − π/2 — rather than against this function's own output.
    const [lng, lat] = unprojectMercator(-8235000, 4975000);
    expect(lng).toBeCloseTo(-73.976264, 5);
    expect(lat).toBeCloseTo(40.746350, 5);
  });
});

describe("toLngLat", () => {
  it("swaps a latitude-first ring", () => {
    expect(toLngLat(ring([40.7, -73.9]), "latlng", "wgs84")).toEqual([[-73.9, 40.7]]);
    expect(toLngLat(ring([35.6, 139.7]), "latlng", "wgs84")).toEqual([[139.7, 35.6]]);
  });

  it("leaves a named position alone whatever the file's axis is", () => {
    const named: RawRing = [{ a: -73.9, b: 40.7, fixed: true }];

    expect(toLngLat(named, "latlng", "wgs84")).toEqual([[-73.9, 40.7]]);
  });

  it("drops what the schema would refuse", () => {
    expect(toLngLat(ring([0, 0], [999, 0], [1, 1]), "lnglat", "wgs84")).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });
});

describe("openRing", () => {
  it("drops the closing point and leaves an open ring alone", () => {
    expect(openRing([[0, 0], [1, 0], [0, 0]])).toEqual([[0, 0], [1, 0]]);
    expect(openRing([[0, 0], [1, 0]])).toEqual([[0, 0], [1, 0]]);
  });
});

describe("isClosed", () => {
  it("needs four points, so a repeated pair is not a boundary", () => {
    expect(isClosed(ring([0, 0], [1, 0], [0, 0]))).toBe(false);
    expect(isClosed(ring([0, 0], [1, 0], [1, 1], [0, 0]))).toBe(true);
    expect(isClosed(ring([0, 0], [1, 0], [1, 1], [0, 1]))).toBe(false);
  });
});
