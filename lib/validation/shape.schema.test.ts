import { describe, expect, it } from "vitest";

import { MIN_CIRCLE_RADIUS_M } from "@/packages/shared/shapes";
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_OPACITY,
  MAX_POLYGON_POINTS,
  createShapeSchema,
  shapeGeometrySchema,
  updateShapeSchema,
} from "./shape.schema";

const circle = { kind: "circle", lng: 25.28, lat: 54.687, radius: 1200 };
const triangle = {
  kind: "polygon",
  points: [
    [25.27, 54.68],
    [25.29, 54.68],
    [25.28, 54.7],
  ],
};

describe("shapeGeometrySchema", () => {
  it("accepts a circle", () => {
    expect(shapeGeometrySchema.parse(circle)).toEqual(circle);
  });

  it("accepts a polygon", () => {
    expect(shapeGeometrySchema.parse(triangle)).toEqual(triangle);
  });

  it("rejects a circle smaller than a handle can be grabbed at", () => {
    expect(
      shapeGeometrySchema.safeParse({ ...circle, radius: MIN_CIRCLE_RADIUS_M - 1 })
        .success,
    ).toBe(false);
  });

  it("rejects a polygon that encloses nothing", () => {
    const twoPoints = { kind: "polygon", points: triangle.points.slice(0, 2) };
    expect(shapeGeometrySchema.safeParse(twoPoints).success).toBe(false);
  });

  it("rejects a polygon past the point cap", () => {
    const points = Array.from({ length: MAX_POLYGON_POINTS + 1 }, (_, index) => [
      index / 10_000,
      0,
    ]);

    expect(shapeGeometrySchema.safeParse({ kind: "polygon", points }).success).toBe(
      false,
    );
  });

  it("rejects a point outside the world", () => {
    const offMap = { kind: "polygon", points: [...triangle.points, [200, 0]] };
    expect(shapeGeometrySchema.safeParse(offMap).success).toBe(false);
  });

  it("rejects an unknown kind rather than guessing", () => {
    expect(
      shapeGeometrySchema.safeParse({ kind: "rectangle", points: triangle.points })
        .success,
    ).toBe(false);
  });
});

describe("createShapeSchema", () => {
  it("fills in a colour and opacity so a drawn shape needs neither", () => {
    const parsed = createShapeSchema.parse({ name: "Zone", geometry: circle });

    expect(parsed.color).toBe(DEFAULT_SHAPE_COLOR);
    expect(parsed.opacity).toBe(DEFAULT_SHAPE_OPACITY);
    expect(parsed.sortOrder).toBe(0);
  });

  it("needs a name", () => {
    expect(createShapeSchema.safeParse({ name: "  ", geometry: circle }).success).toBe(
      false,
    );
  });

  it("lowercases a hex colour so two spellings compare equal", () => {
    const parsed = createShapeSchema.parse({
      name: "Zone",
      geometry: circle,
      color: "#E8590C",
    });

    expect(parsed.color).toBe("#e8590c");
  });
});

describe("updateShapeSchema", () => {
  it("takes one field at a time, which is what a handle drag sends", () => {
    expect(updateShapeSchema.parse({ geometry: circle })).toEqual({
      geometry: circle,
    });
  });

  it("refuses an empty patch", () => {
    expect(updateShapeSchema.safeParse({}).success).toBe(false);
  });
});
