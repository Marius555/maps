"use client";

import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  Map as MapLibreMap,
} from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";

import type { Shape } from "@/lib/repositories/types";
import type { ShapeGeometry, ShapeKind } from "@/packages/shared/shapes";
import {
  SHAPE_HIT_LAYERS,
  SHAPE_SOURCE,
  addShapeLayers,
  draftFeatures,
  shapeFeature,
  type ShapeFeatures,
} from "./shape-layers";

/**
 * Keeps the shape source in step with the shapes array — plus whatever is being
 * dragged or drawn at this instant.
 *
 * Two overrides sit on top of the saved data, and both exist so a gesture can be
 * seen before it is saved:
 *
 * - `preview` replaces one saved shape's geometry while its handle is held. The
 *   PATCH does not fire until the handle is released, so without this the circle
 *   would sit still while the handle moved away from it.
 * - `draw` adds a shape that has no row at all yet — the circle being dragged
 *   out, the polygon being clicked round.
 *
 * Neither goes through React state. A drag produces a position per pointer
 * sample, and a `setState` per sample would re-render the editor sixty times a
 * second to move geometry the map is perfectly capable of redrawing itself.
 */
export function useShapeLayers({
  map,
  isReady,
  shapes,
  selectedShapeId,
  selectedShapeIds,
  drawMode,
  isRouting,
  colorFor,
  onSelect,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  /**
   * Already resolved: a bonded line arrives here with its ends at the locations
   * it is tied to. map-editor.tsx does that once for the canvas and the sidebar
   * together — see the memo there for why it cannot be done per renderer.
   */
  shapes: Shape[];
  selectedShapeId: string | null;
  /** Shapes picked by the marquee or a group. They light up the same way. */
  selectedShapeIds?: ReadonlySet<string>;
  /** The armed drawing tool, or null. Only the hover cursor cares. */
  drawMode: ShapeKind | null;
  /**
   * Whether the route tool is armed.
   *
   * Separate from `drawMode` because a route is not a `ShapeKind`. Every guard
   * below asks `isArmed` rather than `drawMode` for that reason: each one that
   * read the kind alone was a click the route tool never received.
   */
  isRouting?: boolean;
  /** Paint colour per shape, group colour included. Defaults to `shape.color`. */
  colorFor?: (shape: Shape) => string;
  onSelect: (shapeId: string) => void;
}) {
  /** Any tool that reads clicks off the canvas, route tool included. */
  const isArmed = drawMode !== null || Boolean(isRouting);

  const shapesRef = useRef(shapes);
  const selectedRef = useRef(selectedShapeId);
  const selectedManyRef = useRef(selectedShapeIds);
  const colorForRef = useRef(colorFor);
  const onSelectRef = useRef(onSelect);

  /** id → the geometry a held handle is currently describing. */
  const previews = useRef(new globalThis.Map<string, ShapeGeometry>());
  /** The shape being drawn, which has no id yet. */
  const drawing = useRef<ShapeGeometry | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  /*
   * Empty deps, and it reads `map.current` inside — the idiom `streetAt` in
   * map-editor.tsx uses. Listing the ref object as a dependency instead makes the
   * React Compiler refuse to optimise the whole hook, because what it infers from
   * a `.current` read never matches what was written down.
   */
  const redraw = useCallback(() => {
    const source = map.current?.getSource(SHAPE_SOURCE) as
      | GeoJSONSource
      | undefined;

    source?.setData(
      buildFeatures(
        shapesRef.current,
        selectedRef.current,
        selectedManyRef.current,
        colorForRef.current,
        previews.current,
        drawing.current,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Source and layers, added once — and again after every style swap.
   *
   * `setStyle` (use-maplibre.ts, on a basemap or theme change) discards every
   * source and layer on the map. Pins survive it because they are DOM elements
   * the style knows nothing about; these do not. `styledata` fires once the new
   * style is in, and `addShapeLayers` is idempotent, so re-adding costs nothing
   * on the events that are not style swaps at all.
   */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    const install = () => {
      /*
       * Only when the style swap actually took the source away.
       *
       * `styledata` is not one event per style — it fires repeatedly while a
       * style and its tiles load, and this used to re-serialise every shape on
       * the map each time. On a first load that is the areas visibly redrawing
       * over and over behind a basemap that is still arriving. The add below is
       * idempotent, so the guard is about `redraw`, not about it.
       */
      if (instance.getSource(SHAPE_SOURCE)) return;

      addShapeLayers(instance);
      // The source is added empty and filled here, so there is one code path
      // that turns shapes into features rather than two to keep in step.
      redraw();
    };

    install();
    instance.on("styledata", install);

    return () => {
      instance.off("styledata", install);
    };
  }, [map, isReady, redraw]);

  /*
   * Saved data changed — a shape added, deleted, renamed, recoloured, or moved
   * by someone else's tab — or the selection did, or the colours did.
   *
   * `colorFor` is in here rather than in the identity-free `useEffect` above,
   * because joining or leaving a group repaints shapes whose own rows have not
   * changed at all: without it the source would keep the old colours until
   * something else happened to redraw it.
   *
   * A bonded line is covered by the same dependency without naming it: moving a
   * pin rebuilds the resolved array upstream, so `shapes` is a new value here
   * and the line redraws at its end's new position.
   */
  useEffect(() => {
    shapesRef.current = shapes;
    selectedRef.current = selectedShapeId;
    selectedManyRef.current = selectedShapeIds;
    colorForRef.current = colorFor;
    redraw();
  }, [shapes, selectedShapeId, selectedShapeIds, colorFor, redraw]);

  // Clicking a fill selects it. Registered per layer so MapLibre does the hit
  // testing; the canvas's own click handler checks the same layers before
  // treating a click as a click on the basemap.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    const handleClick = (event: MapLayerMouseEvent) => {
      /*
       * An armed tool owns every click, which is the rule the canvas's own
       * handler already states. Without it a click meant for the tool *also*
       * selects whatever shape it landed on — and for the route tool that is not
       * an edge case but the ordinary one, since stops are pins and pins are
       * routinely inside a delivery radius or a district somebody drew.
       */
      if (isArmed) return;

      const id = event.features?.[0]?.properties?.id;
      if (typeof id === "string" && id) onSelectRef.current(id);
    };

    /*
     * Nothing while a tool is armed. This writes an *inline* cursor onto the
     * canvas, and inline beats the `maplibregl-crosshair` class the container
     * wears in draw mode — so without the guard, dragging a circle across an
     * existing shape swapped the crosshair for a pointer mid-gesture. `leave`
     * resetting to `""` would not restore it either, since the crosshair is not
     * something this handler ever knew about.
     */
    const enter = () => {
      if (isArmed) return;
      instance.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      if (isArmed) return;
      instance.getCanvas().style.cursor = "";
    };

    // Every layer a shape can be drawn in, dashed and dotted included — a
    // marking must not decide whether the thing wearing it can be clicked. The
    // canvas's own handler tests the same list.
    for (const layer of SHAPE_HIT_LAYERS) {
      instance.on("click", layer, handleClick);
      instance.on("mouseenter", layer, enter);
      instance.on("mouseleave", layer, leave);
    }

    return () => {
      for (const layer of SHAPE_HIT_LAYERS) {
        instance.off("click", layer, handleClick);
        instance.off("mouseenter", layer, enter);
        instance.off("mouseleave", layer, leave);
      }
    };
  }, [map, isReady, isArmed]);

  /*
   * Arming a tool while the pointer already sits on a shape leaves the inline
   * `pointer` behind, because `mouseleave` never fires — the guard above is
   * about what happens next, not about what is already on the element.
   */
  useEffect(() => {
    if (!isArmed) return;

    const instance = map.current;
    if (!instance || !isReady) return;

    instance.getCanvas().style.cursor = "";
  }, [map, isReady, isArmed]);

  /** Override one saved shape's geometry for the length of a drag. */
  const preview = useCallback(
    (shapeId: string, geometry: ShapeGeometry | null) => {
      if (geometry) {
        previews.current.set(shapeId, geometry);
      } else {
        previews.current.delete(shapeId);
      }

      redraw();
    },
    [redraw],
  );

  /** Show a shape that is still being drawn. */
  const draw = useCallback(
    (geometry: ShapeGeometry | null) => {
      drawing.current = geometry;
      redraw();
    },
    [redraw],
  );

  return { preview, draw };
}

export type ShapePreview = ReturnType<typeof useShapeLayers>;

/**
 * Saved shapes, plus whatever is being dragged or drawn, as one collection.
 *
 * Module scope rather than a closure inside the hook: it reads nothing but its
 * arguments, and keeping it out here is what lets `redraw` be a `useCallback`
 * with no dependencies at all.
 */
function buildFeatures(
  shapes: Shape[],
  selectedId: string | null,
  selectedIds: ReadonlySet<string> | undefined,
  colorFor: ((shape: Shape) => string) | undefined,
  previews: globalThis.Map<string, ShapeGeometry>,
  drawing: ShapeGeometry | null,
): ShapeFeatures {
  const features = shapes.map((shape) =>
    shapeFeature(
      shape,
      previews.get(shape.id) ?? shape.geometry,
      // One selected shape or a whole marquee's worth look the same on the map.
      // The difference between them is which card opens, not which outline
      // thickens — so the paint expression in shape-layers.ts needs no change.
      shape.id === selectedId || (selectedIds?.has(shape.id) ?? false),
      colorFor?.(shape),
    ),
  );

  if (drawing) features.push(...draftFeatures(drawing));

  return { type: "FeatureCollection", features };
}
