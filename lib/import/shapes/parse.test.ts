import { describe, expect, it } from "vitest";

import { ImportSourceError } from "@/lib/import/sources/types";
import { circleRing, type CircleGeometry } from "@/packages/shared/shapes";
import { parseShapeFile } from "./index";

/**
 * Bytes in, drafts out — the seam test.
 *
 * The per-file suites each prove one stage in isolation; this one is the only
 * place the stages meet, and every bug worth having found here was a bug in the
 * handover rather than in either side of it: a depth read one level off, an axis
 * decided per ring instead of per file, a circle detected and then simplified
 * back into a polygon.
 *
 * The fixtures are real shapes of file rather than minimal ones, because the
 * failures this replaced were all in files that looked fine.
 */

const json = (value: unknown) => JSON.stringify(value);

/** The ring turf, Mapbox Draw and the Google Maps API all emit for a circle. */
function turfCircle(circle: CircleGeometry, segments = 64): number[][] {
  return circleRing(circle, segments).map(([lng, lat]) => [lng, lat]);
}

describe("GeoJSON", () => {
  it("reads a styled FeatureCollection and keeps the file's own colours", () => {
    const result = parseShapeFile(
      json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              name: "Midtown Manhattan Test Area",
              category: "Delivery Zone",
              stroke: "#3b82f6",
              fill: "#3B82F6",
              "fill-opacity": 0.2,
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-73.9985, 40.758],
                  [-73.974, 40.7685],
                  [-73.962, 40.751],
                  [-73.987, 40.7405],
                  [-73.9985, 40.758],
                ],
              ],
            },
          },
        ],
      }),
    );

    expect(result.dialect).toBe("geojson");
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].name).toBe("Midtown Manhattan Test Area");
    expect(result.shapes[0].color).toBe("#3b82f6");
    expect(result.shapes[0].opacity).toBe(0.2);
    expect(result.shapes[0].geometry.kind).toBe("polygon");
    // The repeated closing point is GeoJSON's; our rings are open.
    expect(result.shapes[0].geometry).toMatchObject({ points: expect.any(Array) });
    if (result.shapes[0].geometry.kind === "polygon") {
      expect(result.shapes[0].geometry.points).toHaveLength(4);
    }
  });

  it("fans a MultiPolygon out and numbers the parts", () => {
    const result = parseShapeFile(
      json({
        type: "Feature",
        properties: { NAME: "Islands" },
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
            [
              [
                [5, 5],
                [6, 5],
                [6, 6],
                [5, 5],
              ],
              [
                [5.2, 5.2],
                [5.4, 5.2],
                [5.4, 5.4],
                [5.2, 5.2],
              ],
            ],
          ],
        },
      }),
    );

    expect(result.shapes.map((shape) => shape.name)).toEqual(["Islands 1", "Islands 2"]);
    expect(result.holesDropped).toBe(1);
  });

  it("reads a LineString as a line and a GeometryCollection as both", () => {
    const result = parseShapeFile(
      json({
        type: "Feature",
        properties: { title: "Mixed" },
        geometry: {
          type: "GeometryCollection",
          geometries: [
            {
              type: "LineString",
              coordinates: [
                [0, 0],
                [1, 1],
                [2, 0],
              ],
            },
            {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          ],
        },
      }),
    );

    expect(result.shapes.map((shape) => shape.geometry.kind)).toEqual([
      "line",
      "polygon",
    ]);
  });

  it("keeps a description the file carried", () => {
    const result = parseShapeFile(
      json({
        type: "Feature",
        properties: { name: "Zone", notes: "Weekdays only" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      }),
    );

    expect(result.shapes[0].description).toBe("Weekdays only");
  });
});

describe("loose JSON", () => {
  it("reads an ad-hoc object whose ring is under a name of its own", () => {
    // The file that started this: no `type`, no `coordinates`, no wrapper. The
    // old reader answered "we couldn't find any shapes in that file".
    const result = parseShapeFile(
      json({
        zoneName: "Central Park Radius Polygon",
        ring: [
          [-73.9819, 40.7681],
          [-73.9583, 40.7969],
          [-73.9493, 40.7925],
          [-73.973, 40.7642],
          [-73.9819, 40.7681],
        ],
      }),
    );

    expect(result.dialect).toBe("loose");
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].name).toBe("Central Park Radius Polygon");
    expect(result.shapes[0].geometry.kind).toBe("polygon");
  });

  it("reads a list of zones under arbitrary keys", () => {
    const result = parseShapeFile(
      json({
        result: {
          zones: [
            { label: "North", boundary: [[0, 0], [1, 0], [1, 1], [0, 0]] },
            { label: "South", boundary: [[5, 5], [6, 5], [6, 6], [5, 5]] },
          ],
        },
      }),
    );

    expect(result.shapes.map((shape) => shape.name)).toEqual(["North", "South"]);
  });

  it("reads positions written as objects", () => {
    const result = parseShapeFile(
      json({
        name: "Leaflet zone",
        latlngs: [
          { lat: 40.7, lng: -73.9 },
          { lat: 40.8, lng: -73.9 },
          { lat: 40.8, lng: -74.0 },
        ],
      }),
    );

    expect(result.shapes).toHaveLength(1);
    if (result.shapes[0].geometry.kind === "polygon") {
      expect(result.shapes[0].geometry.points[0]).toEqual([-73.9, 40.7]);
    }
  });

  it("calls an open ring under a route-ish key a line", () => {
    const result = parseShapeFile(
      json({ name: "Delivery run", route: [[0, 0], [1, 1], [2, 3]] }),
    );

    expect(result.shapes[0].geometry.kind).toBe("line");
  });

  it("does not read a list of locations as one polygon", () => {
    expect(() =>
      parseShapeFile(
        json([
          { name: "Shop A", lat: 40.7, lng: -73.9 },
          { name: "Shop B", lat: 40.8, lng: -73.8 },
        ]),
      ),
    ).toThrow(/locations/i);
  });
});

describe("circles", () => {
  it("reads a round polygon back as a circle", () => {
    const circle: CircleGeometry = {
      kind: "circle",
      lng: -73.97,
      lat: 40.78,
      radius: 1200,
    };

    const result = parseShapeFile(
      json({
        type: "Feature",
        properties: { name: "Delivery radius" },
        geometry: { type: "Polygon", coordinates: [turfCircle(circle)] },
      }),
    );

    expect(result.circlesDetected).toBe(1);
    expect(result.shapes[0].geometry.kind).toBe("circle");

    if (result.shapes[0].geometry.kind === "circle") {
      expect(result.shapes[0].geometry.lng).toBeCloseTo(circle.lng, 6);
      expect(result.shapes[0].geometry.lat).toBeCloseTo(circle.lat, 6);
      // Within half a per cent of the radius the file was drawn from.
      expect(result.shapes[0].geometry.radius / circle.radius).toBeCloseTo(1, 2);
    }
  });

  it("leaves a deliberate hexagon a polygon", () => {
    const hexagon = turfCircle(
      { kind: "circle", lng: 0, lat: 0, radius: 5000 },
      6,
    );

    const result = parseShapeFile(
      json({ type: "Polygon", coordinates: [hexagon] }),
    );

    expect(result.circlesDetected).toBe(0);
    expect(result.shapes[0].geometry.kind).toBe("polygon");
  });

  it("reads a Leaflet circle saved as a point plus a radius", () => {
    const result = parseShapeFile(
      json({
        type: "Feature",
        properties: { subType: "Circle", radius: 850, name: "Catchment" },
        geometry: { type: "Point", coordinates: [-73.97, 40.78] },
      }),
    );

    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].geometry).toMatchObject({
      kind: "circle",
      lng: -73.97,
      lat: 40.78,
      radius: 850,
    });
  });

  it("reads a radius written in kilometres", () => {
    const result = parseShapeFile(
      json({ name: "Service area", lat: 40.78, lng: -73.97, radius_km: 2.5 }),
    );

    expect(result.shapes[0].geometry).toMatchObject({ kind: "circle", radius: 2500 });
  });

  it("sends a point with no radius to the locations importer", () => {
    expect(() =>
      parseShapeFile(
        json({
          type: "Feature",
          properties: { name: "A shop" },
          geometry: { type: "Point", coordinates: [-73.97, 40.78] },
        }),
      ),
    ).toThrow(/Locations tab/);
  });
});

describe("coordinates", () => {
  it("detects latitude-first files from a value past ±90", () => {
    // Tokyo, deliberately: New York would prove nothing, because both its
    // coordinates sit inside ±90 and the two orders are indistinguishable there.
    const result = parseShapeFile(
      json({
        name: "Swapped",
        ring: [
          [35.6812, 139.7671],
          [35.6899, 139.7],
          [35.71, 139.81],
        ],
      }),
    );

    expect(result.axis).toBe("latlng");
    expect(result.axisAmbiguous).toBe(false);
    if (result.shapes[0].geometry.kind === "polygon") {
      expect(result.shapes[0].geometry.points[0]).toEqual([139.7671, 35.6812]);
    }
  });

  it("says so when nothing in the file can settle the axis", () => {
    const result = parseShapeFile(
      json({ name: "Ambiguous", ring: [[1, 2], [3, 4], [5, 6]] }),
    );

    expect(result.axis).toBe("lnglat");
    expect(result.axisAmbiguous).toBe(true);
  });

  it("takes the caller's word over the vote", () => {
    const result = parseShapeFile(
      json({ name: "Ambiguous", ring: [[1, 2], [3, 4], [5, 6]] }),
      { axis: "latlng" },
    );

    expect(result.axis).toBe("latlng");
    if (result.shapes[0].geometry.kind === "polygon") {
      expect(result.shapes[0].geometry.points[0]).toEqual([2, 1]);
    }
  });

  it("unprojects Web Mercator metres", () => {
    const result = parseShapeFile(
      json({
        name: "Projected",
        ring: [
          [-8235000, 4975000],
          [-8230000, 4975000],
          [-8230000, 4980000],
        ],
      }),
    );

    expect(result.unprojected).toBe("webmercator");
    if (result.shapes[0].geometry.kind === "polygon") {
      const [lng, lat] = result.shapes[0].geometry.points[0];
      expect(lng).toBeCloseTo(-73.98, 1);
      expect(lat).toBeCloseTo(40.71, 1);
    }
  });

  it("names the projection it cannot convert", () => {
    expect(() =>
      parseShapeFile(
        json({
          geometryType: "esriGeometryPolygon",
          spatialReference: { wkid: 27700 },
          features: [
            {
              attributes: { name: "British grid" },
              geometry: {
                rings: [
                  [
                    [530000, 180000],
                    [531000, 180000],
                    [531000, 181000],
                    [530000, 180000],
                  ],
                ],
              },
            },
          ],
        }),
      ),
    ).toThrow(/EPSG:27700/);
  });
});

describe("Esri JSON", () => {
  it("reads a FeatureSet, splitting outer rings from holes by winding", () => {
    const result = parseShapeFile(
      json({
        geometryType: "esriGeometryPolygon",
        spatialReference: { wkid: 4326 },
        features: [
          {
            attributes: { NAME: "County", OBJECTID: 12 },
            geometry: {
              rings: [
                // Clockwise: an outer ring.
                [
                  [0, 0],
                  [0, 2],
                  [2, 2],
                  [2, 0],
                  [0, 0],
                ],
                // Anticlockwise: a hole.
                [
                  [0.5, 0.5],
                  [1.5, 0.5],
                  [1.5, 1.5],
                  [0.5, 0.5],
                ],
                // Clockwise again: a second island, not a hole.
                [
                  [5, 5],
                  [5, 6],
                  [6, 6],
                  [6, 5],
                  [5, 5],
                ],
              ],
            },
          },
        ],
      }),
    );

    expect(result.dialect).toBe("esri");
    expect(result.shapes.map((shape) => shape.name)).toEqual(["County 1", "County 2"]);
    expect(result.holesDropped).toBe(1);
  });

  it("reads paths as lines", () => {
    const result = parseShapeFile(
      json({
        spatialReference: { wkid: 4326 },
        paths: [
          [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
        ],
      }),
    );

    expect(result.shapes[0].geometry.kind).toBe("line");
  });
});

describe("TopoJSON", () => {
  it("decodes quantised arcs into rings", () => {
    const result = parseShapeFile(
      json({
        type: "Topology",
        transform: { scale: [0.001, 0.001], translate: [-74, 40] },
        arcs: [
          [
            [0, 0],
            [1000, 0],
            [0, 1000],
            [-1000, 0],
            [0, -1000],
          ],
        ],
        objects: {
          zones: {
            type: "GeometryCollection",
            geometries: [
              { type: "Polygon", arcs: [[0]], properties: { name: "Block" } },
            ],
          },
        },
      }),
    );

    expect(result.dialect).toBe("topojson");
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].name).toBe("Block");

    if (result.shapes[0].geometry.kind === "polygon") {
      expect(result.shapes[0].geometry.points).toEqual([
        [-74, 40],
        [-73, 40],
        [-73, 41],
        [-74, 41],
      ]);
    }
  });

  it("reverses a negatively indexed arc", () => {
    const result = parseShapeFile(
      json({
        type: "Topology",
        arcs: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        ],
        objects: {
          a: { type: "LineString", arcs: [-1], properties: { name: "Back" } },
        },
      }),
    );

    if (result.shapes[0].geometry.kind === "line") {
      expect(result.shapes[0].geometry.points).toEqual([
        [1, 1],
        [1, 0],
        [0, 0],
      ]);
    }
  });
});

describe("failures", () => {
  it("refuses a file that is not JSON", () => {
    expect(() => parseShapeFile("name,lat,lng\n")).toThrow(ImportSourceError);
    expect(() => parseShapeFile("name,lat,lng\n")).toThrow(/valid JSON/);
  });

  it("refuses a file with nothing shape-like in it", () => {
    expect(() => parseShapeFile(json({ total: 3, ok: true }))).toThrow(
      /couldn't find any shapes/,
    );
  });

  it("refuses rings with too few corners", () => {
    expect(() => parseShapeFile(json({ ring: [[0, 0]] }))).toThrow(ImportSourceError);
  });
});
