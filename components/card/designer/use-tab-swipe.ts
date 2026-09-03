"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import type { DesignerTab } from "./card-designer-tabs";

/** How far a finger travels before it counts as a swipe rather than a tap. */
const SWIPE_MIN_PX = 48;

/**
 * How much more horizontal than vertical that travel has to be.
 *
 * Two to one. The panel is a tall column whose main gesture is scrolling it, so
 * anything close to diagonal has to stay a scroll — a swipe that fires on a
 * sloppy downward flick would change tabs under someone's thumb mid-read.
 */
const SWIPE_RATIO = 2;

/** The tabs in the order they sit in the strip, which is the order a swipe walks. */
const TAB_ORDER: readonly DesignerTab[] = ["elements", "modify"];

/**
 * Swipe left and right to move between Elements and Modify.
 *
 * The strip is at the top of a panel that fills a phone screen, so on touch it
 * is both the only way across and the furthest thing from the thumb holding the
 * device. A swipe is the gesture every tabbed thing on a phone already has.
 *
 * Four rules, and each one is a bug that would otherwise be shipped:
 *
 * - **Touch pointers only.** A mouse drag across this panel is someone using a
 *   slider, a colour field or a text selection, and none of those should change
 *   tabs. `pointerType` is the only thing that tells them apart, and it is why
 *   this is a pointer handler rather than a touch one.
 * - **Never from a slider.** The Modify tab is mostly horizontal sliders, and
 *   React Aria owns horizontal drags on them — the two gestures are the same
 *   movement over the same pixels, so the control under the finger wins.
 * - **`touch-action: pan-y`**, so the browser keeps vertical scrolling and this
 *   never has to re-implement it. `none` would hand every scroll to the swipe.
 * - **Capture phase.** Every HeroUI `Button` ends `usePress`' own
 *   `onPointerDown` with `stopPropagation()`, and React dispatches synthetic
 *   events from its root — so a bubble-phase handler on a wrapper around one
 *   never fires, silently and with no error. See the same workaround in
 *   components/map/add-location/use-drag-to-add.ts.
 */
export function useTabSwipe(
  activeTab: DesignerTab,
  onTabChange: (tab: DesignerTab) => void,
) {
  /** Where the finger went down, or null when this gesture is not ours. */
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    /*
     * `pan-y` rather than a class, because this hook owns the rule: a caller
     * that forgot it would get a panel whose vertical scrolling had been eaten
     * by a gesture it could not see.
     */
    style: { touchAction: "pan-y" as const },

    onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => {
      start.current = null;
      if (event.pointerType !== "touch") return;

      // React Aria's sliders are `role="slider"`; `.slider` is the HeroUI field
      // around one, which is what a finger landing on the label or the track
      // gutter actually hits.
      if (
        event.target instanceof Element &&
        event.target.closest('[role="slider"], .slider')
      ) {
        return;
      }

      start.current = { x: event.clientX, y: event.clientY };
    },

    onPointerUpCapture: (event: ReactPointerEvent<HTMLElement>) => {
      const from = start.current;
      start.current = null;
      if (!from) return;

      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;

      if (Math.abs(dx) < SWIPE_MIN_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;

      // Swiping left goes forward, the way a carousel does: the content moves
      // with the finger, so the next tab arrives from the right.
      const next = TAB_ORDER.indexOf(activeTab) + (dx < 0 ? 1 : -1);
      const tab = TAB_ORDER[next];

      // No wrap. Two tabs and a wrap means every swipe changes something, which
      // makes the ends impossible to feel.
      if (tab) onTabChange(tab);
    },

    /*
     * A cancelled pointer is a gesture the browser took over — a scroll that
     * won, or the finger leaving the surface. Clearing is what stops the *next*
     * pointerup being measured against a start point from minutes ago.
     */
    onPointerCancelCapture: () => {
      start.current = null;
    },
  };
}
