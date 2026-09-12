"use client";

import type { Map as MapLibreMap } from "maplibre-gl";

import type { Shape } from "@/lib/repositories/types";
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_OPACITY,
} from "@/lib/validation/shape.schema";
import {
  DOT_IMAGE_ID,
  DOT_IMAGE_SIZE,
  DOT_SPACING_PX,
  dotImage,
} from "@/packages/shared/dot-line";
import {
  MIN_POLYGON_POINTS,
  shapePoints,
  shapePolygon,
  strokeWidthOf,
  type ShapeGeometry,
  type ShapeStrokeStyle,
} from "@/packages/shared/shapes";

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
/**
 * The two markings that are not one continuous stroke.
 *
 * A layer each rather than a data-driven `line-dasharray` on the layer above,
 * for the reason the draft layer below gives at length: a dash is drawn by the
 * SDF shader, and a `case` puts *every* feature in the layer through it —
 * including every solid shape, which would then be rasterised differently from
 * the identical shape the embed draws beside it in the preview panel. Splitting
 * them leaves a solid outline on exactly the pixels it has always been on.
 *
 * Splitting them is also what lets each have its own cap. The dashed one keeps
 * a butt cap, because a round cap adds half a width at each end of every dash
 * and closes a [2, 2] gap. Its dash lengths are multiples of the line width, so
 * the pattern scales with a shape's own thickness without either number being
 * touched.
 *
 * **The dotted one is a `symbol` layer and not a line at all**, and that is the
 * one place these two stopped being the same thing with different numbers. A
 * zero-length dash under a round cap is the documented way to dot a line and it
 * draws a *circle only at integer zooms*: the dash pattern is an SDF texture
 * whose horizontal scale is anchored to tile units and corrected in 2× steps,
 * so between two zoom levels the dot is stretched along the line by up to ~1.41×
 * while its height stays pinned to the stroke width. Measured at 6px: round at
 * z15, a visible egg at z15.5. An icon placed along the line has no such scale.
 * See packages/shared/dot-line.ts, which both renderers read.
 */
export const SHAPE_DASHED_LINE_LAYER = "editor-shape-dashed-outlines";
export const SHAPE_DOTTED_LINE_LAYER = "editor-shape-dotted-outlines";
/**
 * The outline of whatever is being drawn right now — dashed, and its own layer.
 *
 * `line-dasharray` *is* data-driven in maplibre-gl 6, so this could have been a
 * `case` on the one line layer. It is not, for one reason: a dashed line is
 * drawn by a different shader (the SDF path), and a `case` puts every feature in
 * that layer through it — including every saved shape, which would then be
 * rasterised differently from the identical shape the embed draws beside it in
 * the preview panel. A second layer keeps the committed outline on exactly the
 * pixels it has always been on and confines the change to the draft.
 *
 * Not in `SHAPE_HIT_LAYERS`: a draft has no row and no id, so there is nothing
 * for a click on it to select.
 */
export const SHAPE_DRAFT_LINE_LAYER = "editor-shape-draft-outlines";
export const SHAPE_VERTEX_LAYER = "editor-shape-vertices";

/**
 * The layers a click has to be tested against before it counts as a click on the
 * basemap. The canvas reads this to decide whether a click clears the selection.
 */
export const SHAPE_HIT_LAYERS = [
  SHAPE_FILL_LAYER,
  SHAPE_LINE_LAYER,
  SHAPE_DASHED_LINE_LAYER,
  SHAPE_DOTTED_LINE_LAYER,
];

type ShapeProperties = {
  id: string;
  color: string;
  opacity: number;
  /** MapLibre expressions read booleans fine; it is the nesting it can't take. */
  selected: boolean;
  /**
   * Whether a fill is meaningful here, and which default width applies. An
   * area's outline is an edge around a fill that is doing most of the talking;
   * a line has no fill, so the same width reads as a hairline rather than as
   * the object itself.
   */
  isLine: boolean;
  /**
   * The outline's width in pixels, already resolved.
   *
   * Resolved in TypeScript rather than in the paint expression because the
   * default depends on the kind, and `strokeWidthOf` is the one place that rule
   * lives — the embed asks it the same question about the same shape.
   */
  width: number;
  /**
   * Which of the three outline layers paints this feature.
   *
   * One tri-state string rather than a `dashed` and a `dotted` boolean: two
   * booleans have four states and only three of them mean anything.
   */
  stroke: ShapeStrokeStyle;
  /**
   * Still being drawn, and not yet a row anybody could open.
   *
   * Which of the two outline layers paints it. Nothing else reads it — a draft
   * is otherwise an ordinary feature, and this is deliberately *not* the same
   * question as `id === ""`, which is what hit-testing already asks.
   */
  draft: boolean;
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
  const isLine = geometry.kind === "line";

  return {
    type: "Feature",
    id: shape.id,
    // A LineString, not a one-ring Polygon: `shapePolygon` closes what it is
    // given, and a closed route is a triangle. What keeps a line unfilled is the
    // fill layer's own geometry-type filter — see addShapeLayers.
    geometry: isLine
      ? { type: "LineString", coordinates: shapePoints(geometry) }
      : { type: "Polygon", coordinates: shapePolygon(geometry) },
    properties: {
      id: shape.id,
      color: color ?? shape.color,
      opacity: shape.opacity,
      selected: isSelected,
      isLine,
      width: strokeWidthOf(isLine, shape.strokeWidth),
      stroke: shape.strokeStyle,
      draft: false,
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
  /**
   * The colour this shape will actually be saved in.
   *
   * It used to be `DEFAULT_SHAPE_COLOR` unconditionally, which made every draft
   * blue and every saved shape something else — `nextShapeDefaults` gives a line
   * or a route the colour of the first pin it was drawn through and everything
   * else the next palette colour. The gap was visible for the whole length of a
   * gesture and worst on a route, which is many clicks long. Defaulted rather
   * than required so a caller with no map to ask still draws something.
   */
  color: string = DEFAULT_SHAPE_COLOR,
): GeoJSON.Feature<GeoJSON.Geometry, ShapeProperties>[] {
  const properties: ShapeProperties = {
    id: "",
    color,
    opacity: DEFAULT_SHAPE_OPACITY,
    selected: true,
    isLine: geometry.kind === "line",
    // The draft has a layer of its own with its own constant width and dash, so
    // neither of these is read while `draft` is true. They are set to what the
    // draft layer draws so that the two cannot disagree if that ever changes.
    width: 2,
    stroke: "solid",
    draft: true,
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

  /*
   * A line stays a line at every length — it never crosses over into being an
   * area the way a polygon-in-progress does at its third point. So the branch
   * below is about the polygon alone, and asking `geometry.kind` here rather
   * than only counting points is what keeps a three-point line from being
   * previewed as a filled triangle.
   */
  const isArea = geometry.kind === "polygon" && points.length >= MIN_POLYGON_POINTS;

  const outline: GeoJSON.Feature<GeoJSON.Geometry, ShapeProperties> = isArea
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

/**
 * How much heavier a selected shape is drawn.
 *
 * A multiplier and not an increment, so it means the same thing at every width:
 * at 1px an added 2px would treble a hairline, and at 12px it would be invisible.
 */
const SELECTED_WIDTH_SCALE = 1.5;

/**
 * One outline layer per marking, in the order they are stacked.
 *
 * A table rather than three near-identical `addLayer` calls: the paint block is
 * the same in all three and only the filter, the cap and the dash differ, so the
 * ways they can drift apart are exactly the ways they are meant to.
 */
const OUTLINE_LAYERS: {
  id: string;
  stroke: ShapeStrokeStyle;
  cap: "round" | "butt";
  dash: [number, number] | null;
}[] = [
  { id: SHAPE_LINE_LAYER, stroke: "solid", cap: "round", dash: null },
  // Butt, because a round cap adds half a width at each end of every dash and at
  // this spacing that closes the gaps and draws a solid line with dents in it.
  { id: SHAPE_DASHED_LINE_LAYER, stroke: "dashed", cap: "butt", dash: [2, 2] },
  // Dotted is not here: it is a symbol layer, added below. See the note on
  // SHAPE_DOTTED_LINE_LAYER.
];

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
        /*
         * Areas only — and this is not belt and braces.
         *
         * A `fill` layer does **not** ignore a LineString. MapLibre hands its
         * fill bucket whatever geometry the source has and tessellates the
         * points as a ring, so an unfiltered fill layer paints a line's own
         * points as a solid polygon: a three-point route renders as a filled
         * triangle with the route drawn along two of its sides.
         *
         * Matched on geometry type rather than on the `isLine` property,
         * because it is the geometry that decides whether a fill is meaningful.
         * The vertex layer below filters the same way for the same reason.
         */
        filter: ["==", ["geometry-type"], "Polygon"],
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

  for (const outline of OUTLINE_LAYERS) {
    if (map.getLayer(outline.id)) continue;

    map.addLayer(
      {
        id: outline.id,
        type: "line",
        source: SHAPE_SOURCE,
        filter: [
          "all",
          // Saved shapes only. The draft has its own layer below, and without
          // this it would be painted twice — solid underneath its own dashes,
          // which is simply a solid line.
          ["!", ["get", "draft"]],
          ["==", ["get", "stroke"], outline.stroke],
        ],
        layout: { "line-join": "round", "line-cap": outline.cap },
        paint: {
          "line-color": ["get", "color"],
          // The outline is drawn at full opacity whatever the fill is set to. A
          // shape at 5% fill still has to be findable, and its edge is what
          // makes it so.
          "line-opacity": 1,
          /*
           * The width is already resolved per feature — see `shapeFeature`.
           *
           * Selecting a shape multiplies it rather than adding to it, which
           * reproduces exactly what the two hard-coded pairs used to say (an
           * area's 2 became 3, a line's 4 became 6) and keeps saying something
           * proportionate once the owner picks 10.
           */
          "line-width": [
            "case",
            ["get", "selected"],
            ["*", ["get", "width"], SELECTED_WIDTH_SCALE],
            ["get", "width"],
          ],
          ...(outline.dash ? { "line-dasharray": outline.dash } : {}),
        },
      },
      beforeId,
    );
  }

  /*
   * The shape under the cursor: thin, and dashed.
   *
   * Every drawing tool paints through the same draft channel, so one layer
   * covers all of them — the circle being dragged out, the polygon being clicked
   * round, the line, and the straight run between a route's stops. That is the
   * point of styling the *channel* rather than each tool: a dashed outline means
   * "this is not saved yet" wherever it appears, and a new tool inherits the
   * vocabulary without having to remember it.
   *
   * It says something true in each case, and something extra for a route.
   * `use-draw-route.ts` draws the straight run between stops deliberately,
   * because until the engine answers nobody knows where the roads go; a dashed
   * straight line reads as the placeholder it is, where a solid one read as a
   * route that had been worked out and went through buildings.
   *
   * Thinner for the same reason. A draft carries `selected: true`, so on the
   * layer above it was drawn at the heaviest width there is — the boldest thing
   * on the map was the one thing that did not exist yet.
   *
   * Dash lengths are multiples of the line width, so the 2px width below makes
   * this a 4px dash and a 4px gap. Change one and the other moves.
   */
  if (!map.getLayer(SHAPE_DRAFT_LINE_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_DRAFT_LINE_LAYER,
        type: "line",
        source: SHAPE_SOURCE,
        filter: ["get", "draft"],
        // Butt rather than the round cap above: a round cap adds half a width at
        // each end of every dash, which at this size closes the gaps and draws a
        // solid line with dents in it.
        layout: { "line-join": "round", "line-cap": "butt" },
        paint: {
          "line-color": ["get", "color"],
          "line-opacity": 1,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      },
      beforeId,
    );
  }

  /*
   * Dots, as icons along the line rather than as a dash pattern.
   *
   * `icon-color` needs an SDF image, which is what `dotImage` returns — one
   * image for every colour on the map, rather than one per colour added and
   * evicted as the owner recolours things.
   *
   * `icon-allow-overlap` and `icon-ignore-placement` both on, because this is
   * not a label: MapLibre's collision detection would drop dots wherever a
   * route passes near a place name, and a dotted line with gaps in it reads as
   * a line that stops.
   */
  if (!map.hasImage(DOT_IMAGE_ID)) {
    map.addImage(DOT_IMAGE_ID, dotImage(), { sdf: true });
  }

  if (!map.getLayer(SHAPE_DOTTED_LINE_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_DOTTED_LINE_LAYER,
        type: "symbol",
        source: SHAPE_SOURCE,
        filter: [
          "all",
          ["!", ["get", "draft"]],
          ["==", ["get", "stroke"], "dotted"],
        ],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": DOT_SPACING_PX,
          "icon-image": DOT_IMAGE_ID,
          // The selected multiplier is the one the outline layers apply, so a
          // selected dotted shape thickens by the same proportion as every
          // other kind.
          "icon-size": [
            "/",
            [
              "case",
              ["get", "selected"],
              ["*", ["get", "width"], SELECTED_WIDTH_SCALE],
              ["get", "width"],
            ],
            DOT_IMAGE_SIZE,
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-color": ["get", "color"] },
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
