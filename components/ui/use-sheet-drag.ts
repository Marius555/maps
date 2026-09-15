"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Dragging a bottom sheet open and shut.
 *
 * The gesture half of `components/ui/bottom-sheet.tsx`, and so shared by the
 * editor's locations panel, the card designer's sidebar and the publish
 * designer's. It knows nothing about any of them: two refs, a boolean and a
 * setter.
 *
 * Pointer events and three window listeners — the pattern
 * `components/map/add-location/use-drag-to-add.ts` and
 * `components/groups/use-row-drag.ts` already run, and for the same reasons:
 * HTML5 drag does not fire on touch at all, and this gesture exists for phones
 * first.
 *
 * **The pan is refused declaratively, by `touch-action: none` on the grab
 * strip.** `preventDefault()` on a pointer event is a no-op for panning — the
 * bug `docs/notes/editor-and-layout.md` records at length — and there is no
 * stillness test to hang a non-passive `touchmove` off here, because a sheet
 * handle has nothing to scroll. The strip is a dedicated grip, so giving the
 * whole of it to the drag costs nothing; the list below it keeps its own
 * `pan-y`.
 *
 * **Bound in the capture phase.** The grab strip contains a HeroUI-free plain
 * `<button>` today, but every press handler in this app is capture-bound for one
 * reason — React Aria's `usePress` ends its `onPointerDown` with
 * `stopPropagation()` and React dispatches from its root, so a bubble handler on
 * a wrapper around any HeroUI control never fires, silently. Capture runs
 * top-down, out of that reach, and costs nothing to use pre-emptively.
 */

/** How far a pointer travels before a press on the strip becomes a drag. */
const SLOP = 6;

/**
 * How far the sheet must travel before release snaps it to the other state.
 *
 * Distance, not velocity: a flick is already covered — it passes 48px long
 * before the finger lifts — and a velocity test would make a slow, deliberate
 * half-open drag land back where it started, which is the one case a person is
 * clearly telling you what they want.
 */
const SNAP = 48;

export function useSheetDrag({
  isOpen,
  onOpenChange,
  sheet,
  peek,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The sheet itself — its height is half of the travel. */
  sheet: React.RefObject<HTMLElement | null>;
  /** The strip that stays on screen when it is shut — the other half. */
  peek: React.RefObject<HTMLElement | null>;
}) {
  /**
   * Where the sheet is *right now*, in pixels of `translateY`, or null when it
   * is resting at whichever end `isOpen` says.
   *
   * A pixel rather than a fraction, because the resting positions are `0` and
   * `calc(100% - var(--sheet-peek))` and only one of those is a number. The
   * drag works in the same units the element is already translated in, and
   * hands the whole thing back to CSS the moment it ends.
   */
  const [dragY, setDragY] = useState<number | null>(null);

  /**
   * A drag that ended over the handle must not also be a press on it.
   *
   * The handle is a real `<button>`, so keyboard and mouse click both toggle
   * through `onClick` — but a pointer released after 200px of dragging fires a
   * click too, and would undo the drag that just landed. Reset on the next
   * press rather than on a timer, so a drag that ended somewhere else cannot
   * leave this armed against an unrelated click later.
   */
  const swallowClick = useRef(false);

  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      swallowClick.current = false;

      // Left button only for a mouse; touch and pen report 0 here anyway.
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const box = sheet.current;
      const strip = peek.current;
      if (!box || !strip) return;

      /*
       * Asked of the DOM at press time rather than tracked, because it is the
       * one number that cannot be wrong that way: the sheet is a dvh box on a
       * phone whose browser chrome collapses mid-scroll, and a travel measured
       * at mount is a sheet that stops short of its own edge afterwards.
       */
      const travel = box.offsetHeight - strip.offsetHeight;
      if (travel <= 0) return;

      const startY = event.clientY;
      const startOffset = isOpen ? travel : 0;
      let offset = startOffset;
      let moved = false;

      const onMove = (move: PointerEvent) => {
        const delta = startY - move.clientY;
        if (!moved && Math.abs(delta) < SLOP) return;

        moved = true;
        offset = Math.min(travel, Math.max(0, startOffset + delta));
        setDragY(travel - offset);
      };

      const onEnd = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);

        setDragY(null);
        if (!moved) return;

        swallowClick.current = true;

        /*
         * Past the snap in either direction the sheet goes where it was pushed.
         * Short of it, it returns to where it started — `setDragY(null)` above
         * has already done that, so there is deliberately nothing to do.
         */
        const delta = offset - startOffset;
        if (delta > SNAP) onOpenChange(true);
        else if (delta < -SNAP) onOpenChange(false);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [isOpen, onOpenChange, peek, sheet],
  );

  /** True once, for the click that follows a drag. See `swallowClick`. */
  const consumeClick = useCallback(() => {
    const swallow = swallowClick.current;
    swallowClick.current = false;
    return swallow;
  }, []);

  return { dragY, isDragging: dragY !== null, onPointerDownCapture, consumeClick };
}
