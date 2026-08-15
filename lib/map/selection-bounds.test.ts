import { describe, expect, it } from "vitest";

import type { ShapeGeometry } from "@/packages/shared/shapes";
import { selectionBounds } from "./selection-bounds";

const vilnius = { lng: 25.28, lat: 54.687 };
const kaunas = { lng: 23.9, lat: 54.898 };

const triangle: ShapeGeometry = {
  kind: "polygon",
  points: [
    [24.0, 55.5],
    [24.5, 55.5],
    [24.25, 56.0],
  ],
};

describe("selectionBounds", () => {
  it("is null for an empty selection", () => {
    expect(selectionBounds({ points: [], geometries: [] })).toBeNull();
  });

  it("holds a single pin as degenerate bounds", () => {
    expect(selectionBounds({ points: [vilnius], geometries: [] })).toEqual({
      west: 25.28,
      east: 25.28,
      south: 54.687,
      north: 54.687,
    });
  });

  it("spans several pins", () => {
    const bounds = selectionBounds({
      points: [vilnius, kaunas],
      geometries: [],
    });

    expect(bounds).toEqual({
      west: 23.9,
      east: 25.28,
      south: 54.687,
      north: 54.898,
    });
  });

  it("spans shapes on their own", () => {
    const bounds = selectionBounds({ points: [], geometries: [triangle] });

    expect(bounds).toEqual({
      west: 24.0,
      east: 24.5,
      south: 55.5,
      north: 56.0,
    });
  });

  it("lets a shape's extent widen a selection its pins did not reach", () => {
    const bounds = selectionBounds({
      points: [vilnius],
      geometries: [triangle],
    });

    expect(bounds).toEqual({
      west: 24.0,
      east: 25.28,
      south: 54.687,
      north: 56.0,
    });
  });

  it("ignores a shape with no geometry to speak of", () => {
    const empty: ShapeGeometry = { kind: "polygon", points: [] };

    expect(selectionBounds({ points: [vilnius], geometries: [empty] })).toEqual({
      west: 25.28,
      east: 25.28,
      south: 54.687,
      north: 54.687,
    });
    expect(selectionBounds({ points: [], geometries: [empty] })).toBeNull();
  });

  it("takes a circle's whole extent, not just its centre", () => {
    const circle: ShapeGeometry = {
      kind: "circle",
      lng: 25.28,
      lat: 54.687,
      radius: 2000,
    };

    const bounds = selectionBounds({ points: [], geometries: [circle] });

    expect(bounds).not.toBeNull();
    expect(bounds!.west).toBeLessThan(25.28);
    expect(bounds!.east).toBeGreaterThan(25.28);
    expect(bounds!.south).toBeLessThan(54.687);
    expect(bounds!.north).toBeGreaterThan(54.687);
  });
});
