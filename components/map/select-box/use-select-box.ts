"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { boxFrom, isBoxUsable, type SelectBox } from "@/lib/map/marquee";

/**
 * Drag a box around the things you want.
 *
 * Structurally this is `use-draw-circle.ts` — pointer events on MapLibre's own
 * canvas container, pointer capture so a drag that leaves the canvas keeps
 * reporting, `dragPan` disabled for the length of the gesture so the same drag
 * does not also pan the map underneath it. Read that file for why those three
 * choices are what they are; there is no second answer here.
 *
 * The one real difference is the coordinate space. A circle is drawn in degrees
 * because it lives on the ground. A marquee is a rectangle on a *screen*: the
 * user drew it over pixels, and on a rotated or pitched map the same rectangle
 * is a quadrilateral on the ground. So this reports canvas pixels and the
 * caller projects each candidate into the same space to test it.
 */
export function useSelectBox({
  map,
  isReady,
  isActive,
  onPreview,
  onSelect,
  onCancel,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  isActive: boolean;
  /** The box as it currently stands, or null once the gesture is over. */
  onPreview: (box: SelectBox | null) => void;
  /** A finished box, in canvas pixels. */
  onSelect: (box: SelectBox) => void;
  /** Escape, or a press that never became a drag. */
  onCancel: () => void;
}) {
  const handlers = useRef({ onPreview, onSelect, onCancel });

  useEffect(() => {
    handlers.current = { onPreview, onSelect, onCancel };
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isActive) return;

    const canvas = instance.getCanvasContainer();
    let start: { x: number; y: number } | null = null;
    let pointerId: number | null = null;

    /** Canvas-relative pixels, which is the space `project` reports in too. */
    const at = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };

    const finish = () => {
      start = null;
      pointerId = null;
      instance.dragPan.enable();
      handlers.current.onPreview(null);
    };

    const onPointerDown = (event: PointerEvent) => {
      // Secondary buttons are for context menus, not for selecting.
      if (event.button !== 0) return;

      start = at(event);
      pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      instance.dragPan.disable();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== pointerId) return;

      handlers.current.onPreview(boxFrom(start, at(event)));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== pointerId) return;

      const box = boxFrom(start, at(event));

      finish();

      /*
       * A press with no drag is a click, and a click on the map means "nothing
       * is selected". Treating it as a 1px marquee would pick up whatever pin
       * happened to be under it, which is not what a click looks like it does.
       * Cancelling leaves the tool armed, so the next press is a fresh attempt.
       */
      if (!isBoxUsable(box)) {
        handlers.current.onCancel();
        return;
      }

      handlers.current.onSelect(box);
    };

    const onPointerCancel = () => {
      if (!start) return;
      finish();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (start) finish();
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
