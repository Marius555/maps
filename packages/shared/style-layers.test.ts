import { describe, expect, it } from "vitest";

import { applyLayerToggles, CYCLEWAY_LAYER_ID } from "./style-layers";
import type { StyleLike } from "./style-tint";

/**
 * Real layers again, filters included, because the filters are half the rule:
 * a rail line and a road are the same `source-layer` and are told apart only by
 * the class their filter names.
 */
const STYLE: StyleLike = {
  sources: {
    ne2_shaded: { type: "raster" },
    openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "background", type: "background" },
    { id: "water", type: "fill", "source-layer": "water" },
    {
      id: "road_minor",
      type: "line",
      "source-layer": "transportation",
      filter: ["match", ["get", "class"], ["minor"], true, false],
    },
    {
      id: "road_path_pedestrian",
      type: "line",
      "source-layer": "transportation",
      filter: ["match", ["get", "class"], ["path", "pedestrian"], true, false],
    },
    {
      id: "road_major_rail",
      type: "line",
      "source-layer": "transportation",
      filter: ["==", ["get", "class"], "rail"],
    },
    {
      id: "road_transit_rail",
      type: "line",
      "source-layer": "transportation",
      filter: ["==", ["get", "class"], "transit"],
    },
    { id: "building", type: "fill", "source-layer": "building" },
    { id: "building-3d", type: "fill-extrusion", "source-layer": "building" },
    {
      id: "poi_r1",
      type: "symbol",
      "source-layer": "poi",
      filter: [">=", ["get", "rank"], 1],
    },
    {
      id: "poi_transit",
      type: "symbol",
      "source-layer": "poi",
      filter: ["match", ["get", "class"], ["airport", "bus", "rail"], true, false],
    },
    { id: "label_city", type: "symbol", "source-layer": "place" },
  ],
};

function visibility(style: StyleLike, id: string): unknown {
  const layer = style.layers?.find((candidate) => candidate.id === id);
  return (layer?.layout as Record<string, unknown> | undefined)?.visibility;
}

describe("applyLayerToggles", () => {
  it("leaves the style alone when every toggle is at the shipped default", () => {
    const result = applyLayerToggles(STYLE, {
      poi: true,
      transit: true,
      buildings: true,
      buildings3d: true,
      paths: true,
      cycling: false,
    });

    for (const layer of result.layers ?? []) {
      const layout = layer.layout as Record<string, unknown> | undefined;
      expect(layout?.visibility === "none").toBe(false);
    }
  });

  it("tells a flat building footprint from an extruded one", () => {
    const result = applyLayerToggles(STYLE, { buildings3d: false });

    expect(visibility(result, "building-3d")).toBe("none");
    expect(visibility(result, "building")).toBeUndefined();
  });

  /**
   * The overlap that has to be decided rather than left to layer order:
   * `poi_transit` is a POI layer by source and a transit layer by meaning, so
   * turning off either one has to take it with them.
   */
  it("hides station markers with either the transit or the POI switch", () => {
    expect(visibility(applyLayerToggles(STYLE, { transit: false }), "poi_transit")).toBe(
      "none",
    );
    expect(visibility(applyLayerToggles(STYLE, { poi: false }), "poi_transit")).toBe(
      "none",
    );
  });

  it("hides rail and transit lines without touching the roads beside them", () => {
    const result = applyLayerToggles(STYLE, { transit: false });

    expect(visibility(result, "road_major_rail")).toBe("none");
    expect(visibility(result, "road_transit_rail")).toBe("none");
    expect(visibility(result, "road_minor")).toBeUndefined();
    expect(visibility(result, "road_path_pedestrian")).toBeUndefined();
  });

  it("hides paths and pedestrian streets on their own", () => {
    const result = applyLayerToggles(STYLE, { paths: false });

    expect(visibility(result, "road_path_pedestrian")).toBe("none");
    expect(visibility(result, "road_minor")).toBeUndefined();
  });

  it("never touches labels, water or the background", () => {
    const result = applyLayerToggles(STYLE, {
      poi: false,
      transit: false,
      buildings: false,
      buildings3d: false,
      paths: false,
    });

    expect(visibility(result, "label_city")).toBeUndefined();
    expect(visibility(result, "water")).toBeUndefined();
    expect(visibility(result, "background")).toBeUndefined();
  });

  describe("cycling", () => {
    /**
     * The one toggle that draws rather than reveals: OpenMapTiles files a
     * cycleway as `class: "path"` with `subclass: "cycleway"`, so the basemap
     * gives it the same thin dash as every footpath and there is no layer to
     * turn on.
     */
    it("adds a cycleway layer under the labels, on the style's own source", () => {
      const result = applyLayerToggles(STYLE, { cycling: true });
      const ids = (result.layers ?? []).map((layer) => layer.id);
      const added = result.layers?.find((layer) => layer.id === CYCLEWAY_LAYER_ID);

      expect(added?.source).toBe("openmaptiles");
      expect(added?.["source-layer"]).toBe("transportation");
      expect(JSON.stringify(added?.filter)).toContain("cycleway");
      // Under every label, or the green ribbon paints over the street names.
      expect(ids.indexOf(CYCLEWAY_LAYER_ID)).toBeLessThan(ids.indexOf("poi_r1"));
    });

    it("adds nothing when it is off", () => {
      const result = applyLayerToggles(STYLE, { cycling: false });

      expect(result.layers?.some((layer) => layer.id === CYCLEWAY_LAYER_ID)).toBe(false);
    });

    /** Applied twice — a restyle, a republish — must not stack two of them. */
    it("adds exactly one however many times it runs", () => {
      const once = applyLayerToggles(STYLE, { cycling: true });
      const twice = applyLayerToggles(once, { cycling: true });

      expect(
        twice.layers?.filter((layer) => layer.id === CYCLEWAY_LAYER_ID),
      ).toHaveLength(1);
    });

    /** A raster-only style has nothing to draw cycleways from. */
    it("adds nothing when the style has no vector source", () => {
      const result = applyLayerToggles(
        { sources: { hillshade: { type: "raster" } }, layers: [] },
        { cycling: true },
      );

      expect(result.layers).toHaveLength(0);
    });
  });

  it("does not mutate the style it was given", () => {
    applyLayerToggles(STYLE, { poi: false, cycling: true });

    expect(visibility(STYLE, "poi_r1")).toBeUndefined();
    expect(STYLE.layers).toHaveLength(11);
  });
});
