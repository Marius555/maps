"use client";

import type { Map as MapLibreMap } from "maplibre-gl";

import type { Shape } from "@/lib/repositories/types";
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_OPACITY,
} from "@/lib/validation/shape.schema";
import { shapePolygon, type ShapeGeometry } from "@/packages/shared/shapes";

/**
 * Shapes as MapLibre style layers.
 *
 * Places are DOM `Marker`s, and shapes cannot be: a filled area is not an element
 * that can sit above the canvas, it is geometry the map has to rasterise. So this
 * is the one part of the editor that works the way the embed does — a GeoJSON
 * source and layers reading from it.
 *
 * That difference has a consequence the pins never had. `setStyle` — which
 * use-maplibre.ts calls whenever the basemap or the theme changes — throws away
 * every source and layer. use-shape-layers.ts re-adds these on `styledata` for
 * exactly that reason.
 *
 * Feature properties are flat scalars only. MapLibre serialises features to its
 * worker, and a nested object does not survive the trip — which is why the embed
 * already stringifies a whole place into one property.
 */

export const SHAPE_SOURCE = "editor-shapes";
export const SHAPE_FILL_LAYER = "editor-shape-fills";
export const SHAPE_LINE_LAYER = "editor-shape-outlines";
export const SHAPE_VERTEX_LAYER = "editor-shape-vertices";

/**
 * The layers a click has to be tested against before it counts as a click on the
 * basemap. The canvas reads this to decide whether a click clears the selection.
 */
export const SHAPE_HIT_LAYERS = [SHAPE_FILL_LAYER, SHAPE_LINE_LAYER];

type ShapeProperties = {
  id: string;
  color: string;
  opacity: number;
  /** MapLibre expressions read booleans fine; it is the nesting it can't take. */
  selected: boolean;
};

export type ShapeFeatures = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  ShapeProperties
>;

const EMPTY: ShapeFeatures = { type: "FeatureCollection", features: [] };

/**
 * One saved shape as a feature.
 *
 * Circles arrive here as a centre and a radius and leave as a ring of points —
 * see packages/shared/shapes.ts for why MapLibre cannot be handed the circle
 * itself.
 */
export function shapeFeature(
  shape: Shape,
  geometry: ShapeGeometry,
  isSelected: boolean,
  /** Overrides the shape's own colour. A group's, when it is in one. */
  color?: string,
): GeoJSON.Feature<GeoJSON.Geometry, ShapeProperties> {
  return {
    type: "Feature",
    id: shape.id,
    geometry: { type: "Polygon", coordinates: shapePolygon(geometry) },
    properties: {
      id: shape.id,
      color: color ?? shape.color,
      opacity: shape.opacity,
      selected: isSelected,
    },
  };
}

/**
 * The shape being drawn right now, which has no row yet.
 *
 * Below three points a polygon encloses nothing, so it is drawn as a line — the
 * rubber band the user is dragging out — and only becomes a filled area once it
 * could actually be one. Every clicked vertex also gets a Point feature so the
 * user can see what they have placed; the vertex layer is what draws those.
 */
export function draftFeatures(
  geometry: ShapeGeometry,
): GeoJSON.Feature<GeoJSON.Geometry, ShapeProperties>[] {
  const properties: ShapeProperties = {
    id: "",
    color: DEFAULT_SHAPE_COLOR,
    opacity: DEFAULT_SHAPE_OPACITY,
    selected: true,
  };

  if (geometry.kind === "circle") {
    return [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: shapePolygon(geometry) },
        properties,
      },
    ];
  }

  const points = geometry.points;
  if (points.length === 0) return [];

  const outline: GeoJSON.Feature<GeoJSON.Geometry, ShapeProperties> =
    points.length >= 3
      ? {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: shapePolygon(geometry) },
          properties,
        }
      : {
          type: "Feature",
          geometry: { type: "LineString", coordinates: points },
          properties,
        };

  return [
    outline,
    ...points.map((point) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: point },
      properties,
    })),
  ];
}

/**
 * Where our layers belong in the basemap's stack.
 *
 * Under the first symbol layer, so street and place names stay legible through a
 * translucent fill. Appending at the very top instead would put a coloured wash
 * over every label on the map.
 */
function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
}

/** Idempotent: safe to call again after a style swap has dropped everything. */
export function addShapeLayers(map: MapLibreMap, data: ShapeFeatures = EMPTY): void {
  if (!map.getSource(SHAPE_SOURCE)) {
    map.addSource(SHAPE_SOURCE, { type: "geojson", data });
  }

  const beforeId = firstSymbolLayerId(map);

  if (!map.getLayer(SHAPE_FILL_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_FILL_LAYER,
        type: "fill",
        source: SHAPE_SOURCE,
        paint: {
          // Per feature, so recolouring one shape is a data update rather than a
          // rebuilt match expression.
          "fill-color": ["get", "color"],
          "fill-opacity": ["get", "opacity"],
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(SHAPE_LINE_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_LINE_LAYER,
        type: "line",
        source: SHAPE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          // The outline is solid whatever the fill is set to. A shape at 5% fill
          // still has to be findable, and its edge is what makes it so.
          "line-opacity": 1,
          "line-width": ["case", ["get", "selected"], 3, 2],
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(SHAPE_VERTEX_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_VERTEX_LAYER,
        type: "circle",
        source: SHAPE_SOURCE,
        // Only the points a polygon-in-progress emits. A saved shape's own
        // vertices are draggable DOM handles, not dots.
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      },
      beforeId,
    );
  }
}
