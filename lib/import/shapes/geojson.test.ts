import { describe, expect, it } from "vitest";

import { ImportSourceError } from "@/lib/import/sources/types";
import { parseShapeFile } from "./index";

/**
 * The GeoJSON path, held to exactly what it did before the reader learned every
 * other dialect.
 *
 * Kept whole and moved rather than rewritten: this is the regression suite for
 * the one format that already worked, and the risk in making a parser more
 * accommodating is entirely that it starts accommodating the files it used to
 * read correctly. Two expectations changed, and both say so where they are.
 */

/** A closed square ring, the way GeoJSON requires one to be written. */
const SQUARE = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

function polygon(properties: Record<string, unknown> | null = null) {
  return {
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [SQUARE] },
  };
}

function collection(...features: unknown[]) {
  return JSON.stringify({ type: "FeatureCollection", features });
}

describe("parseShapeFile, on GeoJSON", () => {
  it("reads a FeatureCollection into one shape per feature", () => {
    const result = parseShapeFile(
      collection(
        polygon({ name: "Nunavut" }),
        polygon({ name: "Yukon" }),
        polygon({ name: "Alberta" }),
      ),
    );

    expect(result.shapes).toHaveLength(3);
    expect(result.shapes.map((shape) => shape.name)).toEqual([
      "Nunavut",
      "Yukon",
      "Alberta",
    ]);
  });

  it("drops the repeated closing point", () => {
    const [shape] = parseShapeFile(collection(polygon())).shapes;

    // GeoJSON closes its rings; our `points` is open and both renderers close it
    // themselves. Keeping the repeat would put a duplicate vertex handle on top
    // of the first one.
    expect(shape.geometry.kind).toBe("polygon");
    expect(shape.geometry.kind !== "circle" && shape.geometry.points).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
  });

  it("gives each shape its own colour", () => {
    const result = parseShapeFile(
      collection(polygon({ name: "A" }), polygon({ name: "B" })),
    );

    // Thirteen identical blue regions is a map nobody can read.
    expect(result.shapes[0].color).not.toBe(result.shapes[1].color);
  });

  describe("names", () => {
    it.each([
      ["name", "Ontario"],
      ["NAME", "ONTARIO"],
      ["Name", "Ontario"],
      ["title", "Ontario"],
      ["TITLE", "ONTARIO"],
    ])("reads a name from %s", (key, value) => {
      const result = parseShapeFile(collection(polygon({ [key]: value })));

      expect(result.shapes[0].name).toBe(value);
    });

    it("numbers anything with no name at all", () => {
      const result = parseShapeFile(collection(polygon(), polygon()));

      expect(result.shapes.map((shape) => shape.name)).toEqual(["Area 1", "Area 2"]);
    });

    it("ignores a name that is only whitespace", () => {
      const result = parseShapeFile(collection(polygon({ name: "   " })));

      expect(result.shapes[0].name).toBe("Area 1");
    });

    it("truncates a name past the column's width", () => {
      const long = "x".repeat(400);
      const result = parseShapeFile(collection(polygon({ name: long })));

      // varchar(128). An overflow fails the insert for the whole chunk it
      // travelled in, not just its own row.
      expect(result.shapes[0].name).toHaveLength(128);
    });
  });

  describe("geometry types", () => {
    it("splits a MultiPolygon into one shape per polygon", () => {
      const result = parseShapeFile(
        JSON.stringify({
          type: "Feature",
          properties: { name: "Islands" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [[SQUARE], [SQUARE], [SQUARE]],
          },
        }),
      );

      expect(result.shapes).toHaveLength(3);
      // Numbered, or an archipelago imports as identical rows nobody can tell
      // apart in the sidebar.
      expect(result.shapes.map((shape) => shape.name)).toEqual([
        "Islands 1",
        "Islands 2",
        "Islands 3",
      ]);
    });

    it("reads a LineString as a line", () => {
      const result = parseShapeFile(
        JSON.stringify({
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        }),
      );

      expect(result.shapes[0].geometry.kind).toBe("line");
    });

    it("splits a MultiLineString", () => {
      const result = parseShapeFile(
        JSON.stringify({
          type: "MultiLineString",
          coordinates: [
            [
              [0, 0],
              [1, 1],
            ],
            [
              [2, 2],
              [3, 3],
            ],
          ],
        }),
      );

      expect(result.shapes).toHaveLength(2);
      expect(result.shapes.every((s) => s.geometry.kind === "line")).toBe(true);
    });

    it("reads a bare Feature", () => {
      expect(parseShapeFile(JSON.stringify(polygon())).shapes).toHaveLength(1);
    });

    it("reads a bare geometry", () => {
      const result = parseShapeFile(
        JSON.stringify({ type: "Polygon", coordinates: [SQUARE] }),
      );

      expect(result.shapes).toHaveLength(1);
    });

    it("reads a bare coordinate array as a ring", () => {
      expect(parseShapeFile(JSON.stringify(SQUARE)).shapes).toHaveLength(1);
    });

    it("flattens a GeometryCollection", () => {
      const result = parseShapeFile(
        JSON.stringify({
          type: "GeometryCollection",
          geometries: [
            { type: "Polygon", coordinates: [SQUARE] },
            {
              type: "LineString",
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          ],
        }),
      );

      expect(result.shapes.map((shape) => shape.geometry.kind)).toEqual([
        "polygon",
        "line",
      ]);
    });
  });

  describe("holes", () => {
    it("keeps the outer ring and counts the hole", () => {
      const result = parseShapeFile(
        JSON.stringify({
          type: "Polygon",
          coordinates: [
            SQUARE,
            [
              [0.2, 0.2],
              [0.4, 0.2],
              [0.4, 0.4],
              [0.2, 0.2],
            ],
          ],
        }),
      );

      expect(result.shapes).toHaveLength(1);
      // Reported, so the preview can warn that a lake inside a county is about
      // to fill in rather than letting it happen silently.
      expect(result.holesDropped).toBe(1);
    });

    it("reports no holes when there are none", () => {
      expect(parseShapeFile(collection(polygon())).holesDropped).toBe(0);
    });
  });

  describe("bad data", () => {
    it("refuses a file that is not JSON", () => {
      expect(() => parseShapeFile("not json at all")).toThrow(ImportSourceError);
    });

    it("refuses a file with no features", () => {
      expect(() => parseShapeFile(collection())).toThrow(ImportSourceError);
    });

    it("refuses a file whose features are all too small to draw", () => {
      expect(() =>
        parseShapeFile(
          JSON.stringify({ type: "Polygon", coordinates: [[[0, 0]]] }),
        ),
      ).toThrow(ImportSourceError);
    });

    it("explains itself in words the user can act on", () => {
      // §8: an error states what happened and how to fix it.
      expect(() => parseShapeFile("{oops")).toThrow(/valid JSON/i);
    });

    it("drops a null vertex rather than the whole shape", () => {
      const result = parseShapeFile(
        JSON.stringify({
          type: "Polygon",
          coordinates: [[[0, 0], [1, 0], null, [1, 1], [0, 1], [0, 0]]],
        }),
      );

      // One bad vertex is a shape that will not draw; losing it beats losing the
      // import.
      expect(result.shapes).toHaveLength(1);
      expect(
        result.shapes[0].geometry.kind !== "circle" &&
          result.shapes[0].geometry.points,
      ).toHaveLength(4);
    });

    it("drops out-of-range coordinates", () => {
      const result = parseShapeFile(
        JSON.stringify({
          type: "Polygon",
          coordinates: [[[0, 0], [1, 0], [999, 999], [1, 1], [0, 1]]],
        }),
      );

      // They would fail the server's schema and take the whole chunk with them.
      expect(
        result.shapes[0].geometry.kind !== "circle" &&
          result.shapes[0].geometry.points,
      ).toHaveLength(4);
    });

    it("keeps the good features and lists the ones it skipped", () => {
      const result = parseShapeFile(
        collection(polygon({ name: "Good" }), {
          type: "Feature",
          properties: { name: "Broken" },
          geometry: { type: "Point", coordinates: [0, 0] },
        }),
      );

      expect(result.shapes).toHaveLength(1);
      // Was `["Broken"]`. A skip now says *why*, because "had no drawable
      // geometry" covered both a broken ring and a perfectly good point that
      // belongs in the locations importer, and those need different sentences.
      expect(result.skipped).toEqual([{ label: "Broken", reason: "location" }]);
    });
  });

  it("simplifies a ring past the cap and says so", () => {
    /*
     * Deliberately not a clean circle any more.
     *
     * It used to be `[cos, sin]` exactly, and that ring is now recognised for
     * what it is and stored as three numbers — the better outcome, and no longer
     * a test of the simplifier. The wobble is what makes this a coastline rather
     * than a radius.
     */
    const huge = Array.from({ length: 3000 }, (_, index) => {
      const angle = (index / 3000) * 2 * Math.PI;
      const radius = 1 + 0.2 * Math.sin(angle * 9);
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });

    const result = parseShapeFile(
      JSON.stringify({ type: "Polygon", coordinates: [huge] }),
    );

    const [shape] = result.shapes;
    expect(shape.simplifiedFrom).toBe(3000);
    expect(
      shape.geometry.kind !== "circle" && shape.geometry.points.length,
    ).toBeLessThanOrEqual(500);
  });
});
