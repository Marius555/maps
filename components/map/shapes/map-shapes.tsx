"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";

import type { Shape } from "@/lib/repositories/types";
import type { ShapeGeometry, ShapeKind } from "@/packages/shared/shapes";
import { ShapeCard } from "./shape-card/shape-card";
import { useDrawCircle } from "./use-draw-circle";
import { useDrawPolygon } from "./use-draw-polygon";
import { useShapeHandles } from "./use-shape-handles";
import { useShapeLayers } from "./use-shape-layers";

/**
 * Everything shape-shaped that happens inside the canvas, in one component.
 *
 * It exists so `map-canvas-impl.tsx` gains one child and one prop group rather
 * than five hooks and a dozen props — the canvas is already the largest file in
 * the folder, and the import review and preview screens reuse its props without
 * wanting any of this.
 *
 * The four hooks share exactly one thing: the preview channel. Drawing paints
 * through `draw`, dragging a handle paints through `preview`, and both write
 * straight to the GeoJSON source without a React render. See use-shape-layers.ts.
 */
export type MapShapesProps = {
  shapes: Shape[];
  selectedShapeId: string | null;
  /** Which tool is armed, or null in browse mode. */
  drawMode: ShapeKind | null;
  /**
   * What colour to actually paint each shape. Defaults to the shape's own.
   *
   * A shape in a group takes the group's colour, so that membership is visible
   * on the map and not only in the sidebar. Resolved by the caller for the same
   * reason the pins' colour is: `map-editor.tsx` is the only place that knows
   * about groups.
   */
  colorFor?: (shape: Shape) => string;
  onSelectShape: (shapeId: string | null) => void;
  onEditShape?: (shapeId: string) => void;
  onCreateShape: (geometry: ShapeGeometry) => void;
  onUpdateShape: (shapeId: string, geometry: ShapeGeometry) => void;
  /** Leaves the drawing tool — Escape, or a gesture that drew nothing. */
  onStopDrawing: () => void;
};

export function MapShapes({
  map,
  isReady,
  shapes,
  selectedShapeId,
  selectedShapeIds,
  drawMode,
  colorFor,
  onSelectShape,
  onEditShape,
  onCreateShape,
  onUpdateShape,
  onStopDrawing,
}: MapShapesProps & {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  /**
   * Shapes picked out by the marquee or a group, which light up the same way a
   * clicked one does. Empty when the canvas has no selection feature at all.
   */
  selectedShapeIds?: ReadonlySet<string>;
}) {
  const { preview, draw } = useShapeLayers({
    map,
    isReady,
    shapes,
    selectedShapeId,
    selectedShapeIds,
    drawMode,
    colorFor,
    onSelect: onSelectShape,
  });

  /*
   * Looked up here rather than passed in, so the card and the handles follow a
   * shape edited elsewhere — renaming one in the dialog updates the open card,
   * because both read the same query cache entry.
   */
  const selectedShape =
    shapes.find((shape) => shape.id === selectedShapeId) ?? null;

  /**
   * True between a finished gesture and the row for it appearing in `shapes`.
   *
   * The drawing tools clear their draft the moment the pointer comes up, but the
   * create is a round trip — even the optimistic insert is a microtask away,
   * because `useCreateShape.onMutate` opens with `await cancelQueries`. Without
   * this the circle you just drew blinks out and back in. Same rule the handles
   * follow on release: the draft goes when the saved data can replace it.
   */
  const isDrafting = useRef(false);

  const createShape = useCallback(
    (geometry: ShapeGeometry) => {
      isDrafting.current = true;
      // Re-paints what the tool just cleared. Both calls land inside the same
      // pointerup handler, so nothing is painted in between.
      draw(geometry);
      onCreateShape(geometry);
    },
    [draw, onCreateShape],
  );

  useEffect(() => {
    if (!isDrafting.current) return;

    isDrafting.current = false;
    draw(null);
  }, [shapes, draw]);

  useDrawCircle({
    map,
    isReady,
    isActive: drawMode === "circle",
    onPreview: draw,
    onDraw: createShape,
    onCancel: onStopDrawing,
  });

  useDrawPolygon({
    map,
    isReady,
    isActive: drawMode === "polygon",
    onPreview: draw,
    onDraw: createShape,
    onCancel: onStopDrawing,
  });

  useShapeHandles({
    map,
    isReady,
    // No handles while a tool is armed: they sit exactly where the next click
    // would go, and grabbing one instead of drawing is not what anyone meant.
    shape: drawMode ? null : selectedShape,
    onPreview: preview,
    onCommit: onUpdateShape,
  });

  const close = useCallback(() => onSelectShape(null), [onSelectShape]);

  return (
    <ShapeCard
      // Hidden while drawing, like the place card is while adding pins: a card
      // opening over the map is in the way of the thing you are drawing.
      shape={drawMode ? null : selectedShape}
      onClose={close}
      onEdit={onEditShape}
    />
  );
}
