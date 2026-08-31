"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CustomPinIcon } from "@/packages/shared/pin-icons";
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
 * One hook serves every source that can start a drag — the button and each tile
 * in the icon menu — because the gesture is one at a time by definition. Which
 * source it came from travels as the payload handed to `dragProps`, so the ghost
 * knows what to draw and the drop knows what to create.
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
  onDragStart,
  pinIcons,
}: {
  /**
   * Viewport coordinates of the drop, and the icon that was dragged. Deciding
   * what is under those coordinates is the caller's job.
   */
  onDrop: (clientX: number, clientY: number, icon: string) => void;
  /**
   * The moment the press crosses the threshold and becomes a drag.
   *
   * An event rather than something derived from `isDragging`, because what
   * listens to it wants to act once, at the transition — closing the menu the
   * pin was dragged out of, say. Watching the flag in an effect would be a
   * setState cascading off a render, which is both slower and, as the React
   * Compiler's lint rule points out, a misuse of effects.
   */
  onDragStart?: () => void;
  /**
   * The map's own pins, so the ghost can draw a custom one in its own colour.
   * Held in a ref like the handlers are: it is read once, when a drag starts.
   */
  pinIcons?: CustomPinIcon[];
}) {
  const [isDragging, setIsDragging] = useState(false);

  const ghost = useRef<HTMLElement | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ x: 0, y: 0 });
  const started = useRef(false);
  const didDrag = useRef(false);
  /** Which source the press came from. Read at drop, and by the ghost effect. */
  const icon = useRef("");

  // Latest handlers without re-binding the window listeners mid-gesture.
  const dropHandler = useRef(onDrop);
  const startHandler = useRef(onDragStart);
  const custom = useRef(pinIcons);
  useEffect(() => {
    dropHandler.current = onDrop;
    startHandler.current = onDragStart;
    custom.current = pinIcons;
  });

  /*
   * There is no `isDisabled` here any more, and its absence is the point. The
   * plan limit used to switch this off, so a customer at ten locations dragged a
   * pin that never left the button and was told nothing. The gesture now always
   * runs; the 403 it earns is what carries the explanation (see
   * lib/query/plan-limit-toast.ts).
   */
  const onPointerDown = useCallback(
    (event: React.PointerEvent, payload: string) => {
      if (event.button !== 0) return;

      origin.current = { x: event.clientX, y: event.clientY };
      latest.current = { x: event.clientX, y: event.clientY };
      started.current = false;
      didDrag.current = false;
      icon.current = payload;
    },
    [],
  );

  /**
   * Props for one drag source.
   *
   * A factory rather than a fixed object because there are now several sources
   * and each carries a different icon. Memoised on the handler alone — the
   * returned object is new per call, which is fine: it is spread onto a DOM
   * element, not compared.
   */
  const dragProps = useCallback(
    (payload: string) => ({
      onPointerDownCapture: (event: React.PointerEvent) =>
        onPointerDown(event, payload),
      style: HANDLE_STYLE,
    }),
    [onPointerDown],
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
        startHandler.current?.();
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

      if (wasDragging && drop) {
        dropHandler.current(event.clientX, event.clientY, icon.current);
      }
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
   * The ghost exists only for the length of a drag, and so do two things on the
   * body: a pointer dragged across the page still selects text and still shows
   * whatever cursor it passes over, and neither belongs in a gesture carrying a
   * pin.
   *
   * The cursor is a **class**, not the inline `body.style.cursor` this used to
   * set. An inline declaration loses to the `!important` on
   * `.maplibregl-crosshair` (app/globals.css), so dragging a pin across a map
   * that already had a tool armed showed the map's cursor rather than the
   * drag's. The class carries the same `!important` and wins wherever the
   * pointer goes. `is-pin-dragging` is also what the add-mode hover ghost
   * watches, so the two never draw a pin each — see `useAddModeGhost`.
   *
   * `mountDragGhost` takes the pointer's current position rather than waiting for
   * the next `pointermove`, which is also what lets it grow out of the button
   * instead of appearing at the viewport's corner for a frame and snapping.
   */
  useEffect(() => {
    if (!isDragging) return;

    const element = mountDragGhost(
      latest.current.x,
      latest.current.y,
      icon.current,
      custom.current,
    );
    ghost.current = element;

    const { body } = document;
    const previousUserSelect = body.style.userSelect;
    body.classList.add("is-pin-dragging");
    body.style.userSelect = "none";

    return () => {
      element.remove();
      ghost.current = null;
      body.classList.remove("is-pin-dragging");
      body.style.userSelect = previousUserSelect;
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
    /** Spread onto an element a pin can be dragged out of, with its icon id. */
    dragProps,
    consumeDidDrag,
  };
}
