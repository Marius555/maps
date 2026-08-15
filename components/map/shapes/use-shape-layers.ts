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
  SHAPE_FILL_LAYER,
  SHAPE_LINE_LAYER,
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
  colorFor,
  onSelect,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  shapes: Shape[];
  selectedShapeId: string | null;
  /** Shapes picked by the marquee or a group. They light up the same way. */
  selectedShapeIds?: ReadonlySet<string>;
  /** The armed drawing tool, or null. Only the hover cursor cares. */
  drawMode: ShapeKind | null;
  /** Paint colour per shape, group colour included. Defaults to `shape.color`. */
  colorFor?: (shape: Shape) => string;
  onSelect: (shapeId: string) => void;
}) {
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
      if (drawMode) return;
      instance.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      if (drawMode) return;
      instance.getCanvas().style.cursor = "";
    };

    for (const layer of [SHAPE_FILL_LAYER, SHAPE_LINE_LAYER]) {
      instance.on("click", layer, handleClick);
      instance.on("mouseenter", layer, enter);
      instance.on("mouseleave", layer, leave);
    }

    return () => {
      for (const layer of [SHAPE_FILL_LAYER, SHAPE_LINE_LAYER]) {
        instance.off("click", layer, handleClick);
        instance.off("mouseenter", layer, enter);
        instance.off("mouseleave", layer, leave);
      }
    };
  }, [map, isReady, drawMode]);

  /*
   * Arming a tool while the pointer already sits on a shape leaves the inline
   * `pointer` behind, because `mouseleave` never fires — the guard above is
   * about what happens next, not about what is already on the element.
   */
  useEffect(() => {
    if (!drawMode) return;

    const instance = map.current;
    if (!instance || !isReady) return;

    instance.getCanvas().style.cursor = "";
  }, [map, isReady, drawMode]);

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
