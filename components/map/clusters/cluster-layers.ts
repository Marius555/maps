"use client";

import type {
  GeoJSONSource,
  Map as MapLibreMap,
  PointLike,
  StyleSpecification,
} from "maplibre-gl";

import { STACK_ON_TOP } from "@/lib/map/carry-style";
import type { Place } from "@/lib/repositories/types";
import {
  CLUSTER_BUBBLE_RADIUS,
  CLUSTER_COLOR,
  CLUSTER_FONT,
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
} from "@/packages/shared/clusters";

/**
 * The editor's cluster bubbles, as style layers.
 *
 * The published map draws its places *and* its bubbles from one clustered GeoJSON
 * source. The editor cannot: its pins are DOM markers, and dragging one to fix a
 * geocode, the selection ring, the card and route stop picking all hang off that.
 * So this source exists only to be clustered — it draws the bubbles and nothing
 * else, and use-place-clusters.ts reads it back to decide which markers a bubble
 * has swallowed at the current zoom.
 *
 * The look is the embed's, from the same constants (packages/shared/clusters.ts),
 * because the Publish tab draws the real embed next to this canvas.
 */

export const CLUSTER_SOURCE = "editor-place-clusters";
export const CLUSTER_LAYER = "editor-cluster-bubbles";
export const CLUSTER_COUNT_LAYER = "editor-cluster-counts";

const CLUSTER_LAYERS = [CLUSTER_LAYER, CLUSTER_COUNT_LAYER];

/** A point per location, carrying only its id — all the bubbles need to count. */
export type ClusterFeatures = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { id: string }
>;

export function clusterFeatures(places: readonly Place[]): ClusterFeatures {
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [place.lng, place.lat] },
      properties: { id: place.id },
    })),
  };
}

/**
 * Idempotent: safe to call again after a style swap has dropped everything.
 *
 * No `beforeId`, so the bubbles sit over the shapes and over the labels — they
 * stand in for pins, and pins are DOM over everything. `STACK_ON_TOP` tells
 * lib/map/carry-style.ts to put them back in the same place on a theme change.
 */
export function addClusterLayers(map: MapLibreMap, data: ClusterFeatures): void {
  if (!map.getSource(CLUSTER_SOURCE)) {
    map.addSource(CLUSTER_SOURCE, {
      type: "geojson",
      data,
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS,
    });
  }

  if (!map.getLayer(CLUSTER_LAYER)) {
    map.addLayer({
      id: CLUSTER_LAYER,
      type: "circle",
      source: CLUSTER_SOURCE,
      filter: ["has", "point_count"],
      metadata: STACK_ON_TOP,
      paint: {
        "circle-color": CLUSTER_COLOR,
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-radius": CLUSTER_BUBBLE_RADIUS,
      },
    });
  }

  if (!map.getLayer(CLUSTER_COUNT_LAYER)) {
    map.addLayer({
      id: CLUSTER_COUNT_LAYER,
      type: "symbol",
      source: CLUSTER_SOURCE,
      filter: ["has", "point_count"],
      metadata: STACK_ON_TOP,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": [CLUSTER_FONT],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    });
  }
}

export function removeClusterLayers(map: MapLibreMap): void {
  for (const layer of CLUSTER_LAYERS) {
    if (map.getLayer(layer)) map.removeLayer(layer);
  }

  if (map.getSource(CLUSTER_SOURCE)) map.removeSource(CLUSTER_SOURCE);
}

/** Skipped when unchanged, so re-asserting it does not cost a repaint. */
export function setClusterLayersVisible(map: MapLibreMap, isVisible: boolean): void {
  const value = isVisible ? "visible" : "none";

  for (const layer of CLUSTER_LAYERS) {
    if (!map.getLayer(layer)) continue;
    if ((map.getLayoutProperty(layer, "visibility") ?? "visible") === value) continue;

    map.setLayoutProperty(layer, "visibility", value);
  }
}

export function setClusterData(map: MapLibreMap, data: ClusterFeatures): void {
  (map.getSource(CLUSTER_SOURCE) as GeoJSONSource | undefined)?.setData(data);
}

/**
 * The locations that are pins rather than part of a bubble, right now.
 *
 * Read off the source's own tiles with `querySourceFeatures` — the same tiles the
 * bubble layer is drawing — so a pin and the bubble counting it can never both be
 * on screen. A cluster feature carries `cluster_id` and no `id`, so it drops out
 * on its own.
 *
 * Three answers, and the difference between the last two matters:
 * - `null`: past `CLUSTER_MAX_ZOOM` nothing is clustered, so every pin shows and
 *   the tiles are not worth reading.
 * - `undefined`: the source is still tiling (just added, just given new data, or
 *   new tiles coming in at the edge of a pan). Its features are partial, and
 *   treating them as the answer would blink every pin off and back on. The
 *   caller keeps what it had.
 * - a set: the answer.
 */
export function unclusteredPlaceIds(
  map: MapLibreMap,
): Set<string> | null | undefined {
  if (Math.floor(map.getZoom()) > CLUSTER_MAX_ZOOM) return null;
  if (!map.getSource(CLUSTER_SOURCE) || !map.isSourceLoaded(CLUSTER_SOURCE)) {
    return undefined;
  }

  const ids = new Set<string>();

  for (const feature of map.querySourceFeatures(CLUSTER_SOURCE)) {
    const id = feature.properties?.id;
    if (typeof id === "string") ids.add(id);
  }

  return ids;
}

/**
 * Whether a bubble is under this point.
 *
 * For the shape layer's click handler: a bubble is drawn over the shapes, and a
 * click on one sitting inside a polygon is a click on the bubble, not the area.
 */
export function isOnClusterBubble(map: MapLibreMap, point: PointLike): boolean {
  if (!map.getLayer(CLUSTER_LAYER)) return false;

  return map.queryRenderedFeatures(point, { layers: [CLUSTER_LAYER] }).length > 0;
}

/**
 * The live style without the bubbles, for the image export.
 *
 * The export copies `getStyle()` and then draws every location itself
 * (lib/export/export-map.ts). Left in, the bubbles would be drawn over pins they
 * are meant to replace.
 */
export function withoutClusterLayers(style: StyleSpecification): StyleSpecification {
  if (!(CLUSTER_SOURCE in style.sources)) return style;

  return {
    ...style,
    sources: Object.fromEntries(
      Object.entries(style.sources).filter(([id]) => id !== CLUSTER_SOURCE),
    ),
    layers: style.layers.filter(
      (layer) => !("source" in layer) || layer.source !== CLUSTER_SOURCE,
    ),
  };
}
