import { describe, expect, it } from "vitest";

import {
  circleRing,
  MIN_CIRCLE_RADIUS_M,
  type CircleGeometry,
  type LngLatTuple,
} from "@/packages/shared/shapes";
import {
  circleFromRing,
  declaresCircle,
  isDrawableRadius,
  MIN_CIRCLE_VERTICES,
  readRadius,
} from "./circle";

/** A circle written out the way turf, Mapbox Draw and we ourselves write one. */
function drawn(circle: CircleGeometry, segments?: number): LngLatTuple[] {
  // Open, because that is the form the reader has by the time it gets here.
  return circleRing(circle, segments).slice(0, -1);
}

describe("circleFromRing", () => {
  it.each([
    ["the equator", 0],
    ["mid latitudes", 40.78],
    ["far north, where a degree of longitude is half a degree of latitude", 60],
  ])("round-trips a drawn circle at %s", (_label, lat) => {
    const circle: CircleGeometry = { kind: "circle", lng: -73.97, lat, radius: 1200 };
    const found = circleFromRing(drawn(circle));

    expect(found).not.toBeNull();
    expect(found?.lng).toBeCloseTo(circle.lng, 6);
    expect(found?.lat).toBeCloseTo(circle.lat, 6);
    // Half a per cent: the vertices sit *on* the circle, so their mean distance
    // is the radius less the sagitta of one 64th of it.
    expect((found?.radius ?? 0) / circle.radius).toBeCloseTo(1, 2);
  });

  it("reads a 128-sided ring too", () => {
    const circle: CircleGeometry = { kind: "circle", lng: 12, lat: 55, radius: 8000 };

    expect(circleFromRing(drawn(circle, 128))?.radius).toBeCloseTo(8000, -1);
  });

  it("leaves a shape with too few sides alone", () => {
    const circle: CircleGeometry = { kind: "circle", lng: 0, lat: 0, radius: 5000 };

    // A hexagon and a dodecagon pass every other test here. Somebody drew them.
    expect(circleFromRing(drawn(circle, 6))).toBeNull();
    expect(circleFromRing(drawn(circle, 12))).toBeNull();
    expect(circleFromRing(drawn(circle, MIN_CIRCLE_VERTICES))).not.toBeNull();
  });

  it("refuses an ellipse", () => {
    const points: LngLatTuple[] = Array.from({ length: 64 }, (_, index) => {
      const angle = (index / 64) * 2 * Math.PI;
      return [Math.cos(angle) * 0.02, Math.sin(angle) * 0.01];
    });

    expect(circleFromRing(points)).toBeNull();
  });

  it("refuses an arc closed with a chord", () => {
    // Every vertex the same distance from the centre, and plainly not a circle:
    // the gap across the chord gives it away.
    const points: LngLatTuple[] = Array.from({ length: 40 }, (_, index) => {
      const angle = (index / 40) * Math.PI;
      return [Math.cos(angle) * 0.02, Math.sin(angle) * 0.02];
    });

    expect(circleFromRing(points)).toBeNull();
  });

  it("refuses a ring too small to draw", () => {
    const tiny: CircleGeometry = {
      kind: "circle",
      lng: 0,
      lat: 0,
      radius: MIN_CIRCLE_RADIUS_M / 2,
    };

    // Under the floor the renderer would put the resize handle under the move
    // handle, so this has to fall back to being a very small polygon.
    expect(circleFromRing(drawn(tiny))).toBeNull();
  });

  it("refuses a noisy coastline that happens to be roundish", () => {
    const points: LngLatTuple[] = Array.from({ length: 200 }, (_, index) => {
      const angle = (index / 200) * 2 * Math.PI;
      const radius = 0.02 * (1 + 0.2 * Math.sin(angle * 9));
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });

    expect(circleFromRing(points)).toBeNull();
  });
});

describe("readRadius", () => {
  it.each([
    ["radius", 500, 500],
    ["radius_m", 500, 500],
    ["radiusMeters", 500, 500],
    ["radius_km", 2.5, 2500],
    ["radiusKm", 2.5, 2500],
    ["radius_mi", 1, 1609.344],
    ["radius_ft", 100, 30.48],
    ["bufferRadius", 750, 750],
    ["buffer_km", 3, 3000],
    ["serviceRadius", 900, 900],
  ])("reads %s", (key, value, expected) => {
    expect(readRadius({ [key]: value })).toBeCloseTo(expected, 3);
  });

  it("reads a unit named in a field of its own", () => {
    expect(readRadius({ radius: 5, units: "km" })).toBe(5000);
    expect(readRadius({ radius: 5, radiusUnit: "miles" })).toBeCloseTo(8046.72, 2);
  });

  it("reads a number written as a string", () => {
    // What an XML feed and half of every spreadsheet-derived JSON produce.
    expect(readRadius({ radius: "1500" })).toBe(1500);
  });

  it("prefers the more specific key when a record has several", () => {
    expect(readRadius({ range: 99, radius_km: 2 })).toBe(2000);
  });

  it("refuses a key that only starts like a radius", () => {
    // `radiusLabel` is a different field, and reading it as metres would put a
    // five-metre circle on the map with nothing to explain it.
    expect(readRadius({ radiusLabel: 5 })).toBeNull();
  });

  it("refuses nothing, zero and the negative", () => {
    expect(readRadius(null)).toBeNull();
    expect(readRadius({ name: "Zone" })).toBeNull();
    expect(readRadius({ radius: 0 })).toBeNull();
    expect(readRadius({ radius: -100 })).toBeNull();
  });
});

describe("declaresCircle", () => {
  it("recognises what Leaflet and geojson.io write", () => {
    expect(declaresCircle({ subType: "Circle" })).toBe(true);
    expect(declaresCircle({ shapeType: "circle" })).toBe(true);
    expect(declaresCircle({ subType: "Rectangle" })).toBe(false);
    expect(declaresCircle(null)).toBe(false);
  });
});

describe("isDrawableRadius", () => {
  it("holds to the schema's own bounds", () => {
    expect(isDrawableRadius(MIN_CIRCLE_RADIUS_M)).toBe(true);
    expect(isDrawableRadius(MIN_CIRCLE_RADIUS_M - 1)).toBe(false);
    expect(isDrawableRadius(20_000_001)).toBe(false);
    expect(isDrawableRadius(Number.NaN)).toBe(false);
  });
});
