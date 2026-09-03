import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";

import { carryRuntimeLayers } from "./carry-style";

/**
 * A basemap as MapLibre would hand it back from `serialize()` — one vector
 * source, a fill, a line and a label, in that order. The label matters: the
 * editor's shapes go *under* the first symbol layer so place names stay legible
 * through a translucent fill, and putting them back there is most of this file's
 * job.
 */
function basemap(): StyleSpecification {
  return {
    version: 8,
    sources: {
      openmaptiles: { type: "vector", url: "https://tiles.example/planet.json" },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#fff" } },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
      },
      {
        id: "road",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
      },
      {
        id: "place-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
      },
    ],
  };
}

/** The same style with the editor's shape source and layers already on it. */
function withShapes(): StyleSpecification {
  const style = basemap();

  return {
    ...style,
    sources: {
      ...style.sources,
      "editor-shapes": {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      ...style.layers.slice(0, 3),
      { id: "editor-shape-fills", type: "fill", source: "editor-shapes" },
      { id: "editor-shape-outlines", type: "line", source: "editor-shapes" },
      ...style.layers.slice(3),
    ],
  };
}

const ids = (style: StyleSpecification) => style.layers.map((layer) => layer.id);

describe("carryRuntimeLayers", () => {
  it("carries a runtime source the incoming style has never heard of", () => {
    const result = carryRuntimeLayers(withShapes(), basemap());

    expect(result.sources["editor-shapes"]).toEqual({
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  });

  it("puts carried layers back under the labels, in their own order", () => {
    const result = carryRuntimeLayers(withShapes(), basemap());

    // Exactly where addShapeLayers would have put them on a rebuild — the two
    // paths have to agree or the stacking depends on which one ran.
    expect(ids(result)).toEqual([
      "background",
      "water",
      "road",
      "editor-shape-fills",
      "editor-shape-outlines",
      "place-label",
    ]);
  });

  it("still lands under the labels when the style shares no layer ids", () => {
    /*
     * The case that caught the first version of this, in the browser: switching
     * basemap rather than recolouring one. The five OpenFreeMap documents share
     * almost no layer ids, so a position read off the old style has no anchor to
     * find and the shapes ended up on top of every label on the map.
     */
    const next: StyleSpecification = {
      version: 8,
      sources: { openmaptiles: { type: "vector", url: "https://tiles.example/planet.json" } },
      layers: [
        { id: "bg", type: "background" },
        { id: "landuse", type: "fill", source: "openmaptiles", "source-layer": "landuse" },
        { id: "water_name", type: "symbol", source: "openmaptiles", "source-layer": "water_name" },
        { id: "poi_z16", type: "symbol", source: "openmaptiles", "source-layer": "poi" },
      ],
    };

    expect(ids(carryRuntimeLayers(withShapes(), next))).toEqual([
      "bg",
      "landuse",
      "editor-shape-fills",
      "editor-shape-outlines",
      "water_name",
      "poi_z16",
    ]);
  });

  it("appends when the incoming style has no labels to go under", () => {
    const next: StyleSpecification = {
      version: 8,
      sources: { openmaptiles: { type: "vector", url: "https://tiles.example/planet.json" } },
      // "No labels" is a real setting — style-labels.ts hides every symbol
      // layer, and a style could ship without one to begin with.
      layers: [{ id: "background", type: "background" }],
    };

    expect(ids(carryRuntimeLayers(withShapes(), next))).toEqual([
      "background",
      "editor-shape-fills",
      "editor-shape-outlines",
    ]);
  });

  it("returns the next style by reference when there is nothing to carry", () => {
    // The common case, and it has to stay free: a canvas that has never drawn a
    // shape must not pay a rebuilt style object on every theme change.
    const next = basemap();

    expect(carryRuntimeLayers(basemap(), next)).toBe(next);
  });

  it("returns the next style by reference on the first swap of a fresh map", () => {
    const next = basemap();

    expect(carryRuntimeLayers(undefined, next)).toBe(next);
  });

  it("leaves a background layer alone — it names no source", () => {
    const result = carryRuntimeLayers(withShapes(), basemap());

    expect(result.layers.filter((layer) => layer.id === "background")).toHaveLength(1);
  });
});
