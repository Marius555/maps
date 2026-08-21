import type { LayerLike, StyleLike } from "./style-tint";

/**
 * Turning parts of the basemap on and off.
 *
 * The competitor this is measured against offers Traffic, Transit and Bicycling
 * here. Traffic is a live metered feed in the visitor's path, which CLAUDE.md §2
 * forbids outright and §12 rules out at source, so it is not here and never will
 * be. Everything below is already inside the vector tiles we fetch anyway: no
 * extra request, no extra byte, no extra bill.
 *
 * Every toggle is a `layout.visibility` flip on layers the style already has,
 * with one exception — `cycling` has no layer to flip, so it adds one. That is
 * why this can run against all five OpenFreeMap style documents without knowing
 * any of them: layers are matched on their `source-layer` and on what their
 * filter names, never on their id. Ids are a style author's private business and
 * differ between the five; `class: "rail"` on `source-layer: transportation` is
 * the OpenMapTiles schema and is the same everywhere.
 */

export type LayerToggles = {
  poi?: boolean;
  transit?: boolean;
  buildings?: boolean;
  buildings3d?: boolean;
  paths?: boolean;
  cycling?: boolean;
};

/**
 * What Liberty ships, and therefore what an untouched map looks like. Stored
 * rather than inferred: the toggles are persisted on the map and shown in a
 * panel before any style JSON has been fetched, so the panel has to know the
 * answer without asking the network.
 */
export const DEFAULT_LAYER_TOGGLES: Required<LayerToggles> = {
  poi: true,
  transit: true,
  buildings: true,
  buildings3d: true,
  paths: true,
  cycling: false,
};

/** The id of the layer `cycling` adds. Namespaced so it cannot collide. */
export const CYCLEWAY_LAYER_ID = "ofm-appearance-cycleway";

/**
 * Green, and deliberately a plain colour rather than a theme-aware one: the
 * appearance pipeline adds this layer *before* the tint runs, so a theme
 * recolours it into its own figure band along with every other line. A colour
 * chosen per theme here would be a second opinion about the same question.
 */
const CYCLEWAY_COLOR = "#16a34a";

export function applyLayerToggles<T extends StyleLike>(
  style: T,
  toggles: LayerToggles,
): T {
  const layers = Array.isArray(style.layers) ? style.layers : [];

  const next = layers.map((layer) => {
    const wanted = wantedVisibility(layer, toggles);

    return wanted === undefined ? layer : setLayerVisibility(layer, wanted);
  });

  return {
    ...style,
    layers: toggles.cycling ? withCyclewayLayer(next, style) : next,
  };
}

/**
 * Undefined means "no toggle has an opinion about this layer" — the common case,
 * and the one that leaves the style's own choice alone.
 */
function wantedVisibility(
  layer: LayerLike,
  toggles: LayerToggles,
): boolean | undefined {
  const sourceLayer = String(layer["source-layer"] ?? "");
  const filter = JSON.stringify(layer.filter ?? null);

  /** Matches a value the filter compares against, not a substring of one. */
  const names = (...values: string[]) =>
    values.some((value) => filter.includes(`"${value}"`));

  const isTransit = names("rail", "transit");

  if (sourceLayer === "building") {
    return layer.type === "fill-extrusion" ? toggles.buildings3d : toggles.buildings;
  }

  if (sourceLayer === "poi") {
    // Liberty's `poi_transit` is a POI layer by source and a transit layer by
    // meaning. Hiding transit should take the station markers with it; hiding
    // POIs should take them too.
    return isTransit && toggles.transit === false ? false : toggles.poi;
  }

  if (sourceLayer === "transportation" || sourceLayer === "transportation_name") {
    if (isTransit) return toggles.transit;
    if (names("path", "pedestrian")) return toggles.paths;
  }

  return undefined;
}

/**
 * Sets a layer's visibility without disturbing the rest of its layout block —
 * `text-field`, `icon-image` and friends live there too.
 */
export function setLayerVisibility(layer: LayerLike, visible: boolean): LayerLike {
  const layout = (layer.layout ?? {}) as Record<string, unknown>;

  return {
    ...layer,
    layout: { ...layout, visibility: visible ? "visible" : "none" },
  };
}

/**
 * Cycle paths are the one thing here that has to be drawn rather than revealed.
 *
 * OpenMapTiles files a cycleway as `class: "path"` with `subclass: "cycleway"`,
 * so the basemap draws it in the same thin white dash as every footpath and
 * there is no existing layer to turn on. Verified present in the live planet
 * tiles before this was written — an empty `subclass` would have made this a
 * switch that does nothing.
 *
 * Inserted before the first symbol layer so it runs under every label, and
 * anchored to whichever vector source the style actually uses rather than to the
 * name `openmaptiles`, which is Liberty's choice and not a guarantee.
 */
function withCyclewayLayer(layers: LayerLike[], style: StyleLike): LayerLike[] {
  if (layers.some((layer) => layer.id === CYCLEWAY_LAYER_ID)) return layers;

  const source = vectorSourceId(style);
  if (!source) return layers;

  const cycleway: LayerLike = {
    id: CYCLEWAY_LAYER_ID,
    type: "line",
    source,
    "source-layer": "transportation",
    minzoom: 11,
    layout: { "line-cap": "round", "line-join": "round" },
    filter: [
      "all",
      ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
      ["==", ["get", "subclass"], "cycleway"],
    ],
    paint: {
      "line-color": CYCLEWAY_COLOR,
      "line-opacity": 0.85,
      "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 11, 0.6, 20, 6],
    },
  };

  const firstSymbol = layers.findIndex((layer) => layer.type === "symbol");
  const at = firstSymbol === -1 ? layers.length : firstSymbol;

  return [...layers.slice(0, at), cycleway, ...layers.slice(at)];
}

function vectorSourceId(style: StyleLike): string | null {
  const sources = style.sources;
  if (!sources || typeof sources !== "object") return null;

  for (const [id, source] of Object.entries(sources as Record<string, unknown>)) {
    if (source && typeof source === "object" && (source as { type?: string }).type === "vector") {
      return id;
    }
  }

  return null;
}
