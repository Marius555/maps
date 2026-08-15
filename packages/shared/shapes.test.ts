import { describe, expect, it } from "vitest";

import {
  CIRCLE_SEGMENTS,
  circleRing,
  radiusFrom,
  radiusHandle,
  shapeBounds,
  shapeCentre,
  shapeRing,
  type CircleGeometry,
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
