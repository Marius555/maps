"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import {
  MIN_CIRCLE_RADIUS_M,
  radiusFrom,
  type CircleGeometry,
} from "@/packages/shared/shapes";

/**
 * Drag out from the centre to draw a circle.
 *
 * Press where the middle goes, drag until it is the size you want, let go. It is
 * the gesture every drawing tool has used since MacPaint, and it says the radius
 * in the only unit that matters here — how far it reaches on the ground.
 *
 * Pointer events on MapLibre's own canvas container rather than the map's
 * `mousedown`/`touchstart`: one set of handlers covers mouse, pen and touch, and
 * pointer capture means a drag that leaves the canvas still reports its moves
 * instead of freezing at the edge.
 *
 * `dragPan` is disabled for the length of the gesture. Without it the same drag
 * both sizes the circle and pans the map underneath it, and the two fight.
 */
export function useDrawCircle({
  map,
  isReady,
  isActive,
  onPreview,
  onDraw,
  onCancel,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  isActive: boolean;
  /** The circle as it currently stands, or null once the gesture is over. */
  onPreview: (geometry: CircleGeometry | null) => void;
  onDraw: (geometry: CircleGeometry) => void;
  /** Escape, or a press that never became a drag. */
  onCancel: () => void;
}) {
  const handlers = useRef({ onPreview, onDraw, onCancel });

  useEffect(() => {
    handlers.current = { onPreview, onDraw, onCancel };
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isActive) return;

    const canvas = instance.getCanvasContainer();
    let centre: { lng: number; lat: number } | null = null;
    let pointerId: number | null = null;

    /** Canvas-relative coordinates, which is what `unproject` wants. */
    const at = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const { lng, lat } = instance.unproject([
        event.clientX - box.left,
        event.clientY - box.top,
      ]);

      return { lng, lat };
    };

    const finish = () => {
      centre = null;
      pointerId = null;
      instance.dragPan.enable();
      handlers.current.onPreview(null);
    };

    const onPointerDown = (event: PointerEvent) => {
      // Secondary buttons are for context menus, not for drawing.
      if (event.button !== 0) return;

      centre = at(event);
      pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      instance.dragPan.disable();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!centre || event.pointerId !== pointerId) return;

      handlers.current.onPreview({
        kind: "circle",
        ...centre,
        radius: radiusFrom(centre, at(event)),
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!centre || event.pointerId !== pointerId) return;

      const radius = radiusFrom(centre, at(event));
      const drawn = { kind: "circle" as const, ...centre, radius };

      finish();

      /*
       * A press with no drag is not a tiny circle, it is a mis-click — and a
       * circle smaller than its own handles cannot be resized or moved again.
       * Cancelling leaves draw mode armed, so the next press is a fresh attempt.
       */
      if (radius < MIN_CIRCLE_RADIUS_M) {
        handlers.current.onCancel();
        return;
      }

      handlers.current.onDraw(drawn);
    };

    const onPointerCancel = () => {
      if (!centre) return;
      finish();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (centre) finish();
      handlers.current.onCancel();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);

      // Leaving the tool mid-drag must not leave the map unable to pan.
      instance.dragPan.enable();
      handlers.current.onPreview(null);
    };
  }, [map, isReady, isActive]);
}
