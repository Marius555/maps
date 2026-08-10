"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { mountDragGhost, moveDragGhost } from "./drag-ghost";

/**
 * How far the pointer has to travel before a press becomes a drag.
 *
 * Below this it is still a click, which keeps the button's own behaviour intact
 * for anyone who does not mean to drag — a mouse moves a pixel or two under a
 * normal click, and a finger moves several.
 */
const DRAG_THRESHOLD = 8;

/**
 * Without this the browser claims the gesture for scrolling on touch before a
 * single `pointermove` is delivered, and the pin never leaves the button.
 */
const HANDLE_STYLE: React.CSSProperties = { touchAction: "none" };

/**
 * Drag a pin out of a control and drop it on the map.
 *
 * Pointer events rather than HTML5 drag and drop: the latter cannot render a
 * live ghost we control, withholds coordinates until the drop in some browsers,
 * and does not work on touch at all. This is three listeners and a threshold.
 *
 * The press is caught in the **capture** phase, and that is not a detail. React
 * Aria's `usePress` — which every HeroUI Button runs on — ends its own
 * `onPointerDown` with `e.stopPropagation()`, and React dispatches synthetic
 * events from its root, so a bubble-phase handler on any wrapper around the
 * button is never called. No error, no ghost, no drag. Capture handlers run
 * top-down before the target's, so they are out of that reach.
 *
 * Nothing here is state except `isDragging`, which flips twice per gesture. The
 * pointer's position is written straight onto the ghost's `transform`; a
 * `setState` per `pointermove` would re-render the whole toolbar at the
 * pointer's sample rate, for an element React does not need to know about.
 */
export function useDragToAdd({
  onDrop,
  isDisabled,
}: {
  /** Viewport coordinates of the drop. Deciding what is there is the caller's. */
  onDrop: (clientX: number, clientY: number) => void;
  isDisabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const ghost = useRef<HTMLElement | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ x: 0, y: 0 });
  const started = useRef(false);
  const didDrag = useRef(false);

  // Latest handler without re-binding the window listeners mid-gesture.
  const dropHandler = useRef(onDrop);
  useEffect(() => {
    dropHandler.current = onDrop;
  });

  const onPointerDownCapture = useCallback(
    (event: React.PointerEvent) => {
      if (isDisabled || event.button !== 0) return;

      origin.current = { x: event.clientX, y: event.clientY };
      latest.current = { x: event.clientX, y: event.clientY };
      started.current = false;
      didDrag.current = false;
    },
    [isDisabled],
  );

  /*
   * On the window, not on the button. A drag ends wherever the pointer happens
   * to be — over the map, over the locations panel, outside the tab — and a
   * listener on the button would only hear about the ones that came back to it.
   */
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const from = origin.current;
      if (!from) return;

      if (!started.current) {
        const travelled = Math.hypot(event.clientX - from.x, event.clientY - from.y);
        if (travelled < DRAG_THRESHOLD) return;

        started.current = true;
        didDrag.current = true;
        setIsDragging(true);
      }

      // Stops the gesture from also scrolling the page or selecting text.
      event.preventDefault();
      latest.current = { x: event.clientX, y: event.clientY };
      if (ghost.current) moveDragGhost(ghost.current, event.clientX, event.clientY);
    };

    const finish = (event: PointerEvent, drop: boolean) => {
      if (!origin.current) return;

      const wasDragging = started.current;
      origin.current = null;
      started.current = false;
      setIsDragging(false);

      if (wasDragging && drop) dropHandler.current(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => finish(event, true);
    const onPointerCancel = (event: PointerEvent) => finish(event, false);

    // Escape abandons a drag in progress, matching the map's own add mode.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !origin.current) return;

      origin.current = null;
      started.current = false;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  /*
   * The ghost exists only for the length of a drag, and so do two body styles: a
   * pointer dragged across the page still selects text and still shows whatever
   * cursor it passes over, and neither belongs in a gesture carrying a pin.
   *
   * `mountDragGhost` takes the pointer's current position rather than waiting for
   * the next `pointermove`, which is also what lets it grow out of the button
   * instead of appearing at the viewport's corner for a frame and snapping.
   */
  useEffect(() => {
    if (!isDragging) return;

    const element = mountDragGhost(latest.current.x, latest.current.y);
    ghost.current = element;

    const { body } = document;
    const previous = { cursor: body.style.cursor, userSelect: body.style.userSelect };
    body.style.cursor = "grabbing";
    body.style.userSelect = "none";

    return () => {
      element.remove();
      ghost.current = null;
      body.style.cursor = previous.cursor;
      body.style.userSelect = previous.userSelect;
    };
  }, [isDragging]);

  /**
   * True for the press that turned into a drag, so the wrapped button can decline
   * to also treat it as a click. Reading it is what clears it.
   */
  const consumeDidDrag = useCallback(() => {
    const value = didDrag.current;
    didDrag.current = false;
    return value;
  }, []);

  return {
    isDragging,
    /** Spread onto the element the pin is dragged out of. */
    handleProps: { onPointerDownCapture, style: HANDLE_STYLE },
    consumeDidDrag,
  };
}
