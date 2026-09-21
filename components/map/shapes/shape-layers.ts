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
  DOT_TEXT_SIZE,
  DOT_WIDTH_BUCKETS,
  dotImage,
  dotLayerId,
  dotSpacingFor,
  dotWidthFilter,
} from "@/packages/shared/dot-line";
import {
  MIN_LINE_POINTS,
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
 * One dotted layer per stroke width, because `symbol-spacing` is a **layout**
 * property and cannot be data-driven.
 *
 * The dot's size follows the feature (`icon-size` is an expression); the distance
 * between dots cannot, so it has to be a constant per layer. Twelve layers is the
 * whole width range, so every shape lands on exactly one of them and the spacing
 * follows the stroke the way `line-dasharray`'s units used to. A layer no shape on
 * the map matches builds no bucket. See packages/shared/dot-line.ts.
 */
export const SHAPE_DOTTED_LINE_LAYERS = DOT_WIDTH_BUCKETS.map((width) =>
  dotLayerId(SHAPE_DOTTED_LINE_LAYER, width),
);
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
/**
 * The halo under the draft, and the leg hanging off the cursor.
 *
 * Three layers rather than one, and each answers something the single dashed
 * line could not.
 *
 * The **casing** is what makes the band survive the basemap. A 2px coloured line
 * is legible over pale streets and disappears into a dark one, into a park, and
 * into anything it happens to run along — and this map has sixteen looks. A
 * light halo under a coloured stroke is what every road on every one of those
 * basemaps already does for the same reason.
 *
 * The **placed** layer is the other half, and the split is which end of the
 * band you are looking at. The legs already clicked out were drawn identically
 * to the leg hanging off the cursor, so the band said nothing about which part
 * of it was a decision and which part was the pointer — the one question a
 * rubber band exists to answer. Placed legs are solid now; the dashed layer
 * keeps the leg under the cursor, and keeps every other tool exactly as it was,
 * because only the route tool tells `draftFeatures` where the split is.
 *
 * Solid also puts the placed run back off the SDF path, which is the distinction
 * the note above draws: a dash is a different shader, and only the part that has
 * to be dashed goes through it.
 */
export const SHAPE_DRAFT_CASING_LAYER = "editor-shape-draft-casings";
export const SHAPE_DRAFT_PLACED_LAYER = "editor-shape-draft-placed";

/**
 * How heavy the thing being drawn is, before its casing.
 *
 * Named because three layers and `draftFeatures` all have to agree about it. It
 * was 2, which is a hairline: the draft is the only thing on the map that does
 * not exist yet, and it was also the hardest thing on the map to see.
 */
export const DRAFT_LINE_WIDTH = 3;
export const SHAPE_VERTEX_LAYER = "editor-shape-vertices";

/**
 * The layers a click has to be tested against before it counts as a click on the
 * basemap. The canvas reads this to decide whether a click clears the selection.
 */
export const SHAPE_HIT_LAYERS = [
  SHAPE_FILL_LAYER,
  SHAPE_LINE_LAYER,
  SHAPE_DASHED_LINE_LAYER,
  ...SHAPE_DOTTED_LINE_LAYERS,
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
  /**
   * The part of a draft that is a decision rather than the pointer.
   *
   * True only on the run of points somebody has clicked, and only for a tool
   * that says where that run ends — which today is the route tool alone. False
   * everywhere else, including on every saved shape, so the dashed draft layer
   * goes on drawing exactly what it drew before this existed.
   */
  placed: boolean;
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
      placed: false,
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
  /**
   * How many of these points are placed, with the rest being the cursor.
   *
   * Only the route tool passes it, and only it needs to: its gesture is long
   * enough that "which of these did I click" is a live question, and the leg to
   * the pointer is then drawn as the guess it is. Absent — every other tool, and
   * every caller that had one before this existed — the whole draft is one run,
   * exactly as it has always been drawn.
   */
  placed?: number,
): GeoJSON.Feature<GeoJSON.Geometry, ShapeProperties>[] {
  const properties: ShapeProperties = {
    id: "",
    color,
    opacity: DEFAULT_SHAPE_OPACITY,
    selected: true,
    isLine: geometry.kind === "line",
    // The draft has layers of its own with their own constant width and dash, so
    // neither of these is read while `draft` is true. They are set to what the
    // draft layers draw so that the two cannot disagree if that ever changes.
    width: DRAFT_LINE_WIDTH,
    stroke: "solid",
    draft: true,
    placed: false,
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

  if (isArea) {
    return [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: shapePolygon(geometry) },
        properties,
      },
      ...vertices(points, properties),
    ];
  }

  /*
   * The split, and the off-by-one in it is the whole definition.
   *
   * `placed` counts points somebody has clicked, so the placed run is
   * `[0, placed)` and the live one starts at the *last* of them — the leg is
   * drawn from the last stop to the cursor, not from the cursor alone. Either
   * run can come out shorter than two points (nothing clicked yet, or nothing
   * hovered), and a one-point LineString is not a line, so each is dropped when
   * it does.
   *
   * With no `placed` the whole draft is one run and it is *not* marked placed,
   * which is what keeps the circle, polygon and line tools on the dashed layer
   * they have always been drawn on: the live run is then a single point and
   * falls away.
   */
  const at = placed ?? points.length;
  const runs: [GeoJSON.Position[], boolean][] = [
    [points.slice(0, at), placed !== undefined],
    [points.slice(Math.max(0, at - 1)), false],
  ];

  return [
    ...runs
      .filter(([run]) => run.length >= MIN_LINE_POINTS)
      .map(([run, isPlaced]) => ({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: run },
        properties: isPlaced ? { ...properties, placed: true } : properties,
      })),
    ...vertices(points, properties),
  ];
}

/**
 * A dot per clicked point, so a gesture shows what it has taken.
 *
 * Every point including the one under the cursor: the hovered dot is where the
 * next click would land, which is the same thing the band's live leg says at the
 * other end of it.
 */
function vertices(
  points: readonly GeoJSON.Position[],
  properties: ShapeProperties,
): GeoJSON.Feature<GeoJSON.Geometry, ShapeProperties>[] {
  return points.map((point) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: point },
    properties,
  }));
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
  /*
   * The halo, under both of them.
   *
   * Added first so it sits at the bottom of the three — each `addLayer` with the
   * same `beforeId` lands immediately before that layer, so add order is stacking
   * order.
   *
   * White rather than a theme variable, matching the vertex dots' stroke a few
   * layers down. This has to separate a coloured line from sixteen different
   * basemaps, several of which are near-black and several near-white; white
   * reads against every one of them, where a halo that followed the theme would
   * vanish into the light basemaps it was meant to help with.
   *
   * Round cap and join, unlike the dashed stroke above it: the casing is one
   * continuous shape, so there are no gaps for a round cap to close, and a butt
   * cap would leave the coloured line poking out of its own halo at both ends.
   */
  if (!map.getLayer(SHAPE_DRAFT_CASING_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_DRAFT_CASING_LAYER,
        type: "line",
        source: SHAPE_SOURCE,
        filter: ["get", "draft"],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          // Not 1: the draft is drawn over a map somebody is aiming at, and an
          // opaque 7px band would hide the pin it is running towards.
          "line-opacity": 0.85,
          "line-width": DRAFT_LINE_WIDTH + 4,
        },
      },
      beforeId,
    );
  }

  /*
   * The legs already clicked out: solid, and only the route tool produces them.
   *
   * Everything else reaching this source carries `placed: false` and is drawn by
   * the dashed layer below, exactly as it always has been — see `draftFeatures`.
   */
  if (!map.getLayer(SHAPE_DRAFT_PLACED_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_DRAFT_PLACED_LAYER,
        type: "line",
        source: SHAPE_SOURCE,
        filter: ["all", ["get", "draft"], ["get", "placed"]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-opacity": 1,
          "line-width": DRAFT_LINE_WIDTH,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(SHAPE_DRAFT_LINE_LAYER)) {
    map.addLayer(
      {
        id: SHAPE_DRAFT_LINE_LAYER,
        type: "line",
        source: SHAPE_SOURCE,
        filter: ["all", ["get", "draft"], ["!", ["get", "placed"]]],
        // Butt rather than the round cap above: a round cap adds half a width at
        // each end of every dash, which at this size closes the gaps and draws a
        // solid line with dents in it.
        layout: { "line-join": "round", "line-cap": "butt" },
        paint: {
          "line-color": ["get", "color"],
          "line-opacity": 1,
          "line-width": DRAFT_LINE_WIDTH,
          // Dash lengths are multiples of the line width, so `DRAFT_LINE_WIDTH`
          // makes this a 6px dash and a 6px gap. Change one and the other moves.
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

  for (const width of DOT_WIDTH_BUCKETS) {
    const id = dotLayerId(SHAPE_DOTTED_LINE_LAYER, width);

    if (map.getLayer(id)) continue;

    map.addLayer(
      {
        id,
        type: "symbol",
        source: SHAPE_SOURCE,
        filter: [
          "all",
          ["!", ["get", "draft"]],
          ["==", ["get", "stroke"], "dotted"],
          // This layer's share of the dotted shapes: the ones whose stroke is
          // the width its spacing was built for.
          dotWidthFilter(width),
        ],
        layout: {
          "symbol-placement": "line",
          // Constant, because a layout property cannot be an expression — which
          // is the whole reason there are twelve of these layers.
          "symbol-spacing": dotSpacingFor(width),
          // Not about text: it is what stops MapLibre flooring the spacing at the
          // dot image's own pixel width. See `DOT_TEXT_SIZE`.
          "text-size": DOT_TEXT_SIZE,
          "icon-image": DOT_IMAGE_ID,
          // The selected multiplier is the one the outline layers apply, so a
          // selected dotted shape thickens by the same proportion as every
          // other kind. The *spacing* stays where it was: a selection is meant
          // to read as heavier, and re-spacing it would redraw the marking
          // rather than emphasise it.
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
