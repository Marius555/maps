"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { mountDragGhost, moveDragGhost } from "./drag-ghost";

/**
 * The armed pin, following the pointer across the map.
 *
 * There are two ways to add a location and until now only one of them showed
 * you what you were about to place. Drag a tile out of the menu and the pin
 * travels under your hand the whole way; *press* the same tile and the map got
 * a bare cursor — the icon you had just chosen was nowhere on screen, so the
 * one thing sticky add mode is for (drop forty of the same pin without picking
 * it forty times) was also the one thing it never confirmed. Between choosing a
 * café and clicking, nothing said "café".
 *
 * So the same ghost, mounted on hover rather than on a press. It is literally
 * `mountDragGhost` — the drag's own pin, the marker's own pin and the menu
 * tile's own pin are one drawing already (drag-ghost.ts), and a second one for
 * this would be the fourth copy of a thing that has to match the other three.
 *
 * Listeners on the map container rather than the window, which is what makes
 * "leave the map, lose the pin" fall out for free: the toolbar, the locations
 * panel and the page around them are all outside it, and a pin hovering over a
 * button is a pin promising something that button will not do.
 *
 * Mouse and pen only. Touch has no hover — a finger's `pointermove` arrives
 * only while it is down, so on a phone this would flash a pin for the length of
 * a tap and then be replaced by the real marker, which is noise rather than
 * information.
 */
export function useAddModeGhost({
  container,
  isActive,
  icon,
  pinIcons,
}: {
  /** MapLibre's own container — see `map-canvas-impl.tsx`. */
  container: RefObject<HTMLElement | null>;
  /** Sticky add mode is armed. */
  isActive: boolean;
  /** The icon it was armed with, drawn into the ghost. */
  icon: string;
  /** The map's own pins, so a `custom:` id draws in its own colour and shape. */
  pinIcons?: readonly CustomPinIcon[];
}) {
  /*
   * Read at the moment a ghost is built, not a reason to rebind the listeners.
   * The array identity changes whenever the map query settles, and re-running
   * this effect would tear the pin out from under a pointer that never moved.
   */
  const pins = useRef(pinIcons);
  useEffect(() => {
    pins.current = pinIcons;
  });

  useEffect(() => {
    const element = container.current;
    if (!element || !isActive) return;

    let ghost: HTMLElement | null = null;

    const drop = () => {
      ghost?.remove();
      ghost = null;
    };

    const track = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      /*
       * A pin dragged out of the toolbar carries its own ghost, and both
       * gestures can be live at once — the menu can be dragged from while
       * sticky add mode is already armed. Two pins under one pointer is one
       * too many, and the drag's is the one that means something, so this
       * stands down for the length of it.
       */
      if (document.body.classList.contains("is-pin-dragging")) {
        drop();
        return;
      }

      if (ghost) {
        moveDragGhost(ghost, event.clientX, event.clientY);
        return;
      }

      ghost = mountDragGhost(event.clientX, event.clientY, icon, pins.current);
    };

    element.addEventListener("pointermove", track);
    element.addEventListener("pointerleave", drop);
    // A pointer that is captured elsewhere mid-hover — a panning drag that ends
    // outside the window, say — never sends `pointerleave`.
    element.addEventListener("pointercancel", drop);

    return () => {
      element.removeEventListener("pointermove", track);
      element.removeEventListener("pointerleave", drop);
      element.removeEventListener("pointercancel", drop);
      drop();
    };
    // `icon` is in here on purpose: changing the armed pin has to change the pin
    // in the air, and the ghost's drawing is fixed when it is built.
  }, [container, isActive, icon]);
}
