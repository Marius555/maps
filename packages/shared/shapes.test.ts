import { describe, expect, it } from "vitest";

import {
  CIRCLE_SEGMENTS,
  circleRing,
  isAreaGeometry,
  isAreaKind,
  radiusFrom,
  radiusHandle,
  shapeBounds,
  shapeCentre,
  shapePoints,
  strokeWidthOf,
  DEFAULT_AREA_STROKE_WIDTH,
  DEFAULT_LINE_STROKE_WIDTH,
  shapeRing,
  type CircleGeometry,
  type LineGeometry,
  type PolygonGeometry,
} from "./shapes";

function circle(lat: number, radius: number, lng = 0): CircleGeometry {
  return { kind: "circle", lng, lat, radius };
}

/** A 0.01° square with its corners on the axes of a point. */
function square(lng = 0, lat = 0): PolygonGeometry {
  return {
    kind: "polygon",
    points: [
      [lng - 0.01, lat - 0.01],
      [lng + 0.01, lat - 0.01],
      [lng + 0.01, lat + 0.01],
      [lng - 0.01, lat + 0.01],
    ],
  };
}

describe("circleRing", () => {
  it("closes the ring, because MapLibre will not fill one that doesn't", () => {
    const ring = circleRing(circle(0, 1000));

    expect(ring).toHaveLength(CIRCLE_SEGMENTS + 1);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });

  it("puts every point at the requested distance from the centre", () => {
    // Three latitudes, because longitude degrees shrink towards the poles and a
    // circle drawn without that correction is an ellipse everywhere but the
    // equator — the bug this whole file exists to prevent.
    for (const lat of [0, 55, -35]) {
      const shape = circle(lat, 2500);

      for (const [lng, pointLat] of circleRing(shape)) {
        const metres = radiusFrom(shape, { lng, lat: pointLat });
        expect(Math.abs(metres - 2500)).toBeLessThan(1);
      }
    }
  });

  it("honours a coarser segment count", () => {
    expect(circleRing(circle(0, 500), 8)).toHaveLength(9);
  });
});

describe("shapeRing", () => {
  it("closes an open polygon", () => {
    const ring = shapeRing(square());

    expect(ring).toHaveLength(5);
    expect(ring[4]).toEqual(ring[0]);
  });

  it("leaves an already-closed polygon alone", () => {
    const points = square().points;
    const closed: PolygonGeometry = {
      kind: "polygon",
      points: [...points, points[0]],
    };

    expect(shapeRing(closed)).toHaveLength(5);
  });

  it("is empty for a polygon with no points", () => {
    expect(shapeRing({ kind: "polygon", points: [] })).toEqual([]);
  });
});

describe("shapeCentre", () => {
  it("is the centre of a circle", () => {
    expect(shapeCentre(circle(54.687, 800, 25.28))).toEqual({
      lng: 25.28,
      lat: 54.687,
    });
  });

  it("is the mean of a polygon's vertices", () => {
    expect(shapeCentre(square(25.28, 54.687))).toEqual({
      lng: 25.28,
      lat: 54.687,
    });
  });

  it("does not throw on a polygon with no points", () => {
    expect(shapeCentre({ kind: "polygon", points: [] })).toEqual({
      lng: 0,
      lat: 0,
    });
  });
});

describe("shapeBounds", () => {
  it("boxes a polygon", () => {
    expect(shapeBounds(square())).toEqual({
      west: -0.01,
      south: -0.01,
      east: 0.01,
      north: 0.01,
    });
  });

  it("boxes a circle to roughly its diameter", () => {
    const bounds = shapeBounds(circle(0, 1000));
    if (!bounds) throw new Error("a circle always has bounds");

    // 1km either side of the equator, in degrees of latitude.
    expect(bounds.north).toBeCloseTo(1000 / 111_320, 5);
    expect(bounds.south).toBeCloseTo(-1000 / 111_320, 5);
  });

  it("is null for a polygon with no points", () => {
    expect(shapeBounds({ kind: "polygon", points: [] })).toBeNull();
  });
});

describe("radiusHandle", () => {
  it("sits on the border, due east", () => {
    const shape = circle(55, 1500, 25);
    const handle = radiusHandle(shape);

    expect(handle.lat).toBe(55);
    expect(handle.lng).toBeGreaterThan(25);
    expect(radiusFrom(shape, handle)).toBeCloseTo(1500, 6);
  });

  it("round-trips a dragged radius", () => {
    const shape = circle(-35, 400, -58);
    const dragged = { lng: radiusHandle(shape).lng + 0.02, lat: -35 };

    const resized = { ...shape, radius: radiusFrom(shape, dragged) };
    expect(radiusHandle(resized).lng).toBeCloseTo(dragged.lng, 9);
  });
});

/**
 * A line is the one geometry that must come back *open*.
 *
 * `shapeRing` closes what it is given, which is right for an area and is exactly
 * the bug that would turn a two-point route into a degenerate triangle. These
 * hold the type split and `shapePoints` to that, because nothing else will: a
 * closed line still renders, it just renders something the user did not draw.
 */
describe("lines", () => {
  const line: LineGeometry = {
    kind: "line",
    points: [
      [10, 59],
      [11, 60],
      [12, 61],
    ],
  };

  it("keeps a line's path open", () => {
    const points = shapePoints(line);

    expect(points).toHaveLength(3);
    expect(points[points.length - 1]).not.toEqual(points[0]);
  });

  it("still closes an area's ring", () => {
    const ring = shapePoints(square());

    // Four corners plus the repeat that closes it.
    expect(ring).toHaveLength(5);
    expect(ring[4]).toEqual(ring[0]);
  });

  it("does not close a line that happens to end where it started", () => {
    const loop: LineGeometry = {
      kind: "line",
      points: [
        [0, 0],
        [1, 1],
        [0, 0],
      ],
    };

    // A path back to its own start is a valid line, and adding a fourth point
    // would be inventing a segment nobody drew.
    expect(shapePoints(loop)).toHaveLength(3);
  });

  it("bounds a line by its own extent", () => {
    expect(shapeBounds(line)).toEqual({
      west: 10,
      south: 59,
      east: 12,
      north: 61,
    });
  });

  it("centres a line on the mean of its points", () => {
    expect(shapeCentre(line)).toEqual({ lng: 11, lat: 60 });
  });

  it("has no bounds for a line with no points", () => {
    expect(shapeBounds({ kind: "line", points: [] })).toBeNull();
  });

  it("sorts kinds into areas and not-areas", () => {
    expect(isAreaKind("circle")).toBe(true);
    expect(isAreaKind("polygon")).toBe(true);
    expect(isAreaKind("line")).toBe(false);

    expect(isAreaGeometry(line)).toBe(false);
    expect(isAreaGeometry(square())).toBe(true);
  });

  it("carries bonds on the geometry", () => {
    const bonded: LineGeometry = { ...line, from: "place_a", to: "place_b" };

    // They are part of the geometry rather than columns beside it, so anything
    // that spreads a line has to carry them — see use-shape-handles.
    expect(bonded.from).toBe("place_a");
    expect(shapePoints(bonded)).toHaveLength(3);
  });
});

describe("strokeWidthOf", () => {
  /*
   * The whole point of this function is that "nobody has chosen a width" has a
   * different answer for a line than for an area's edge — which is why it cannot
   * be a column default and has to live somewhere both renderers can ask.
   */
  it("falls back to a different width per kind", () => {
    expect(strokeWidthOf(true)).toBe(DEFAULT_LINE_STROKE_WIDTH);
    expect(strokeWidthOf(false)).toBe(DEFAULT_AREA_STROKE_WIDTH);
  });

  it("reads 0, null and undefined as unset", () => {
    // 0 is what every row written before the column existed reads back as, and
    // null is what the mapper turns that into. Neither is a zero-width outline.
    for (const stored of [0, null, undefined]) {
      expect(strokeWidthOf(true, stored)).toBe(DEFAULT_LINE_STROKE_WIDTH);
      expect(strokeWidthOf(false, stored)).toBe(DEFAULT_AREA_STROKE_WIDTH);
    }
  });

  it("keeps a width somebody chose", () => {
    expect(strokeWidthOf(true, 1)).toBe(1);
    expect(strokeWidthOf(false, 12)).toBe(12);
  });

  it("draws the widths both renderers used to hard-code", () => {
    // The numbers themselves are the contract: every shape already on a customer's
    // site has no stored width, so changing either of these moves a live map.
    expect(DEFAULT_LINE_STROKE_WIDTH).toBe(4);
    expect(DEFAULT_AREA_STROKE_WIDTH).toBe(2);
  });
});
