import { describe, expect, it } from "vitest";

import { MIN_CIRCLE_RADIUS_M } from "@/packages/shared/shapes";
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_OPACITY,
  MAX_BULK_SHAPES,
  MAX_POLYGON_POINTS,
  bulkCreateShapesSchema,
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

describe("line geometry", () => {
  const points: [number, number][] = [
    [25.28, 54.687],
    [25.3, 54.7],
  ];

  it("accepts two points, which no area could be", () => {
    expect(shapeGeometrySchema.safeParse({ kind: "line", points }).success).toBe(
      true,
    );
  });

  it("refuses a single point", () => {
    expect(
      shapeGeometrySchema.safeParse({ kind: "line", points: [points[0]] }).success,
    ).toBe(false);
  });

  it("shares the polygon's point cap", () => {
    // Same reason: every point is bytes on every visitor's download.
    const tooMany = Array.from(
      { length: MAX_POLYGON_POINTS + 1 },
      (_, index) => [index / 1000, 0] as [number, number],
    );

    expect(
      shapeGeometrySchema.safeParse({ kind: "line", points: tooMany }).success,
    ).toBe(false);
  });

  it("accepts bonds on either end", () => {
    const parsed = shapeGeometrySchema.parse({
      kind: "line",
      points,
      from: "abc123",
      to: "def456",
    });

    expect(parsed).toMatchObject({ from: "abc123", to: "def456" });
  });

  it("accepts a line with no bonds at all", () => {
    // Absent is what "not bonded" means. A line drawn on open ground is normal.
    expect(shapeGeometrySchema.parse({ kind: "line", points })).not.toHaveProperty(
      "from",
    );
  });

  it("refuses a bond that is not an id", () => {
    expect(
      shapeGeometrySchema.safeParse({
        kind: "line",
        points,
        from: "../../etc/passwd",
      }).success,
    ).toBe(false);
  });

  it("still refuses coordinates off the globe", () => {
    expect(
      shapeGeometrySchema.safeParse({
        kind: "line",
        points: [
          [25.28, 54.687],
          [999, 999],
        ],
      }).success,
    ).toBe(false);
  });
});

describe("bulkCreateShapesSchema", () => {
  const shape = {
    name: "Nunavut",
    geometry: { kind: "polygon", points: [[0, 0], [1, 0], [1, 1]] },
  };

  it("takes a batch of imported shapes", () => {
    const parsed = bulkCreateShapesSchema.parse({ shapes: [shape, shape] });

    expect(parsed.shapes).toHaveLength(2);
    // The per-shape defaults still apply inside a batch, so an import that
    // omits a colour gets the same one a drawn shape would.
    expect(parsed.shapes[0].color).toBe(DEFAULT_SHAPE_COLOR);
  });

  it("refuses an empty batch", () => {
    expect(bulkCreateShapesSchema.safeParse({ shapes: [] }).success).toBe(false);
  });

  it("caps a batch, because a shape is far heavier than a location", () => {
    const tooMany = Array.from({ length: MAX_BULK_SHAPES + 1 }, () => shape);

    expect(bulkCreateShapesSchema.safeParse({ shapes: tooMany }).success).toBe(
      false,
    );
  });
});
