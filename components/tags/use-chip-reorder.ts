"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Dragging one chip in front of another to change what a location's pin wears.
 *
 * **It is a gesture because the rule is an order.** A location wears any number
 * of tags and its pin can only be one colour, so the first tag decides — and
 * that rule is only usable if there is a way to say which one is first. It used
 * to be a coloured dot on every chip but the leading one, pressed to promote it;
 * the dot read as decoration nobody had asked for, so the ordering is done to
 * the chips themselves now. The instruction and the thing it acts on are one
 * object.
 *
 * **Not `useRowDragSource`**, which runs the same gesture for the locations
 * panel and the card designer. That one carries a React context of registered
 * drop targets, a cloned ghost element and an edge autoscroller, because it
 * drags a row across a scrolling panel onto one of many targets. This drags a
 * pill a couple of centimetres inside one box that never scrolls, onto one of
 * its four siblings. What is worth copying from it is the two rules that took
 * real debugging, and both are copied exactly:
 *
 * - **The press is caught in the capture phase.** React Aria's `usePress` — every
 *   HeroUI `Button` — ends its `onPointerDown` with `stopPropagation()`, and
 *   React dispatches synthetic events from its root, so a bubble-phase handler on
 *   an element wrapping a button is never called. It fails silently.
 * - **`touch-action: pan-y`, not `none`.** `none` hands every swipe to us,
 *   including the one someone meant as a scroll of the dialog these chips sit in.
 *   `pan-y` leaves vertical panning to the browser, and we take it back with
 *   `preventDefault()` on the first move *after* the hold fires — which only
 *   works because movement cancels the hold. The browser commits to a pan once
 *   the finger travels and ignores `preventDefault` from then on, so a drag has
 *   to begin from a finger that has not moved.
 *
 * There is no ghost. A ghost exists so the thing being dragged stays visible when
 * it would otherwise be hidden under the pointer or clipped by a scroller;
 * neither is true of a 28px pill in an open box, and dimming the chip that was
 * picked up while outlining the one it would land in front of says the same
 * thing with nothing extra to keep in step.
 *
 * **Keyboard is not the fallback, it is the other half.** The dot this replaced
 * was a real `<button>`, so a drag-only replacement would take away a keyboard
 * user's only route to the pin colour (CLAUDE.md §8: forms usable with a keyboard
 * alone). `Alt` with the left and right arrows moves the focused chip one place,
 * and the element keeps focus across the move because React keys these by tag id.
 */

/**
 * How far the pointer travels before a press becomes a drag.
 *
 * `use-row-drag.ts`'s number, for its reason: a mouse moves a pixel or two under
 * an ordinary click and a finger moves several, so anything smaller would make
 * the × beside the label hard to hit.
 */
const DRAG_THRESHOLD = 8;

/** How long a finger rests on a chip before it is a drag rather than a scroll. */
const TOUCH_HOLD_MS = 250;

/** See the docblock — `pan-y` rather than `none`, and it is load-bearing. */
const CHIP_STYLE: CSSProperties = { touchAction: "pan-y" };

/**
 * `id` moved to where `before` currently sits.
 *
 * Pulled out and pure so the arithmetic is readable: the index is taken *after*
 * the dragged id has been removed, which is what makes dropping a chip onto the
 * one to its right land it on that side rather than a place short of it.
 */
function moveBefore(
  ids: readonly string[],
  id: string,
  before: string,
): string[] {
  const rest = ids.filter((other) => other !== id);
  const at = rest.indexOf(before);
  if (at < 0) return [...ids];

  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** `id` moved one place towards the front or the back, or the list unchanged. */
function nudge(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];

  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);

  return next;
}

export function useChipReorder({
  ids,
  onReorder,
}: {
  /** The chips as they are drawn, in the order they are drawn. */
  ids: readonly string[];
  /** The whole new order. Called once, on release or on an arrow press. */
  onReorder: (next: string[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const origin = useRef<{ x: number; y: number; id: string } | null>(null);
  const started = useRef(false);
  const target = useRef<string | null>(null);
  const hold = useRef<{ timer: number | null; byThreshold: boolean }>({
    timer: null,
    byThreshold: false,
  });

  const clearHold = useCallback(() => {
    if (hold.current.timer !== null) window.clearTimeout(hold.current.timer);
    hold.current = { timer: null, byThreshold: false };
  }, []);

  /*
   * The live values, read by window listeners that are registered once.
   *
   * A gesture that re-registered its own `pointerup` half-way through would be
   * one `pointerup` away from listening to nothing — the same reason
   * `use-row-drag.ts` keeps a `state` ref.
   */
  const state = useRef({ ids, onReorder });
  useEffect(() => {
    state.current = { ids, onReorder };
  });

  const begin = useCallback(() => {
    if (!origin.current || started.current) return;

    started.current = true;
    setDragId(origin.current.id);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent, id: string) => {
      if (event.button !== 0) return;

      // A press that started on the chip's own × is a click on that ×, asked
      // once, about the element actually under the pointer.
      if (
        event.target instanceof Element &&
        event.target.closest("[data-no-drag]")
      ) {
        return;
      }

      origin.current = { x: event.clientX, y: event.clientY, id };
      started.current = false;
      target.current = null;
      clearHold();

      if (event.pointerType === "touch") {
        hold.current.timer = window.setTimeout(() => {
          hold.current.timer = null;
          begin();
        }, TOUCH_HOLD_MS);
      } else {
        hold.current.byThreshold = true;
      }
    },
    [begin, clearHold],
  );

  /*
   * On the window rather than on the chip: a drag ends wherever the pointer
   * happens to be, and a listener on the chip would only hear about the releases
   * that came back to it.
   */
  useEffect(() => {
    const chipAt = (x: number, y: number): string | null => {
      const element = document.elementFromPoint(x, y);

      return (
        element?.closest<HTMLElement>("[data-chip-id]")?.dataset.chipId ?? null
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      const from = origin.current;
      if (!from) return;

      if (!started.current) {
        const travelled = Math.hypot(
          event.clientX - from.x,
          event.clientY - from.y,
        );

        if (!hold.current.byThreshold) {
          /*
           * A finger that moved before its hold fired is scrolling the dialog,
           * so the gesture is over as far as we are concerned. `origin` is
           * dropped outright: a swipe that comes to rest under the finger must
           * not become a drag half a second later.
           */
          if (travelled >= DRAG_THRESHOLD) {
            clearHold();
            origin.current = null;
          }
          return;
        }

        if (travelled < DRAG_THRESHOLD) return;
        begin();
      }

      // Stops the gesture also selecting the labels it passes over, and on touch
      // this is what takes the pan back from the browser.
      event.preventDefault();

      const over = chipAt(event.clientX, event.clientY);
      target.current = over === from.id ? null : over;
      setOverId(target.current);
    };

    const finish = (drop: boolean) => {
      clearHold();

      const from = origin.current;
      const wasDragging = started.current;
      const over = target.current;

      origin.current = null;
      started.current = false;
      target.current = null;
      setDragId(null);
      setOverId(null);

      if (!drop || !wasDragging || !from || !over) return;

      state.current.onReorder(moveBefore(state.current.ids, from.id, over));
    };

    const onPointerUp = () => {
      finish(true);
    };
    const onPointerCancel = () => {
      finish(false);
    };

    /**
     * Escape abandons a drag in progress, matching every other gesture here —
     * and **stops there**, which is the half that only matters inside a dialog.
     *
     * These chips live in the Edit location modal, and Escape is also what
     * closes it. Bound on the bubble the way `use-row-drag.ts` binds its own,
     * one Escape mid-drag put the chip back *and* threw the whole form away —
     * measured, not imagined. So this listens in the **capture** phase, which
     * runs on the window before anything React Aria has on the document, and
     * swallows the key only while something is actually in the air. With no
     * drag in flight it does nothing at all and the modal closes as it always
     * did.
     */
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !origin.current) return;

      // Read before `finish` clears it: a press with the pointer down but no
      // drag begun has nothing to cancel, so the modal is still Escape's.
      const wasDragging = started.current;
      finish(false);

      if (wasDragging) {
        event.stopPropagation();
        event.preventDefault();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onEscape, { capture: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onEscape, { capture: true });
    };
    // Both are `useCallback(_, [])`, so naming them never re-binds the listeners.
  }, [begin, clearHold]);

  /**
   * `Alt` with an arrow, on the focused chip.
   *
   * Alt rather than the bare arrow because a chip sits inside a form: the arrows
   * on their own belong to whatever the browser wants them for, and a bare left
   * arrow on a focused pill is not obviously a move.
   */
  const onArrow = useCallback((event: ReactKeyboardEvent, id: string) => {
    if (!event.altKey) return;

    const by =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (by === 0) return;

    event.preventDefault();
    state.current.onReorder(nudge(state.current.ids, id, by));
  }, []);

  return {
    /** The chip in the air, so it can be dimmed. */
    dragId,
    /** The chip it would land in front of, so it can show where that is. */
    overId,
    /** Spread onto each chip. `data-chip-id` is what the hit test finds. */
    chipProps: (id: string) => ({
      "data-chip-id": id,
      tabIndex: 0,
      style: CHIP_STYLE,
      onPointerDownCapture: (event: ReactPointerEvent) => {
        onPointerDown(event, id);
      },
      onKeyDown: (event: ReactKeyboardEvent) => {
        onArrow(event, id);
      },
    }),
  };
}
