"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  scrollableAncestor,
  startEdgeAutoScroll,
  type EdgeAutoScroll,
} from "@/lib/map/edge-autoscroll";
import { useRowDragState } from "./row-drag-context";
import { mountRowGhost, moveRowGhost, type RowGhost } from "./row-drag-ghost";

/**
 * Dragging one row onto another to group them.
 *
 * **Pointer events, not HTML5 drag-and-drop.** This was native DnD, and four
 * event handlers is genuinely all it took — but two things it cannot do turned
 * out to matter more than the handful of lines it saved:
 *
 * - **It owns the cursor.** From `dragstart` onwards the browser paints its own,
 *   and the row's `cursor: grabbing` is simply ignored. So the gesture with the
 *   least feedback in the app was the one that most needed it: nothing said you
 *   had picked anything up.
 * - **It does not fire on touch at all.** Not degraded — absent. Grouping was
 *   dead on every phone, on a panel CLAUDE.md requires to be usable on one.
 *
 * The replacement is the pattern `components/map/add-location/use-drag-to-add.ts`
 * already runs: a threshold, three window listeners, and a ghost we draw. It also
 * lets a drag carry something HTML5's string payload made awkward — a whole
 * group, which is what merging by drag needs.
 *
 * The press is caught in the **capture** phase, and that is not a detail. React
 * Aria's `usePress` — which every HeroUI Button runs on — ends its own
 * `onPointerDown` with `stopPropagation()`, and React dispatches synthetic events
 * from its root, so a bubble-phase handler on a row wrapping a button is never
 * called. No error, no drag. Capture handlers run top-down, out of that reach.
 */

/**
 * How far the pointer travels before a press becomes a drag.
 *
 * Below this the row is still being clicked, which is what keeps selecting a
 * location from also throwing it into a group. The same 8px `use-drag-to-add`
 * uses, and for the same reason: a mouse moves a pixel or two under a normal
 * click and a finger moves several.
 */
const DRAG_THRESHOLD = 8;

/**
 * How long a finger has to rest on a row before it becomes a drag.
 *
 * Touch has to choose between two gestures that look identical for their first
 * frame: a swipe up the list, and a row being lifted out of it. This used to be
 * settled in the browser's favour of *neither* — `touch-action: none` on every
 * row meant a swipe over a location dragged it and the panel could not be
 * scrolled by finger at all. That was survivable while the panel grew to fit and
 * the page scrolled instead; with a real height it is the only way to scroll.
 *
 * So: movement first means scroll, stillness first means drag. 250ms is long
 * enough not to fire on a flick and short enough not to feel like a wait.
 */
const TOUCH_HOLD_MS = 250;

/**
 * `pan-y`, not `none`.
 *
 * `none` hands every gesture to us, including the swipe someone meant as a
 * scroll. `pan-y` lets the browser take vertical panning, and we take it back
 * for a real drag by calling `preventDefault()` on the first `pointermove`
 * after the hold fires. That only works because the hold is cancelled by
 * movement: the browser commits to a scroll once the finger travels, and a
 * `preventDefault` after that point is ignored. A drag therefore always begins
 * from a finger that has not moved, which is exactly when it is still ours to
 * claim.
 */
const ROW_STYLE: CSSProperties = { touchAction: "pan-y" };

export type DraggedObject = {
  type: "place" | "shape" | "group";
  id: string;
};

/** Two references to the same object, whatever kind it is. */
export function isSameObject(a: DraggedObject, b: DraggedObject): boolean {
  return a.type === b.type && a.id === b.id;
}

/**
 * What a row exposes so it can be picked up.
 *
 * Being a drop *target* is a separate hook — `useDropTarget` — because the two
 * are no longer the same element's business: the ungroup strip is a target and
 * never a source, and a row's own controls have to be neither.
 */
export function useRowDragSource({
  self,
  canDrag = true,
}: {
  /** What this row is, for when it is the one being dragged. */
  self: DraggedObject;
  /**
   * Whether this row can be picked up at all.
   *
   * False on the Locations tab, where nothing accepts a drop: a row that is
   * draggable but has nowhere to go advertises a gesture that silently does
   * nothing, and since rows show a grab cursor it would advertise it in the one
   * place the user is guaranteed to see.
   */
  canDrag?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const { setDragged, setOverId, find } = useRowDragState();

  const origin = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ x: 0, y: 0 });
  const started = useRef(false);
  const ghost = useRef<RowGhost | null>(null);
  const autoScroll = useRef<EdgeAutoScroll | null>(null);

  /**
   * The pending long-press, and whether this gesture needs one at all.
   *
   * `byThreshold` is what separates the two devices. With a mouse it is true and
   * the 8px threshold decides; with a finger it is false and only the timer can
   * start the drag, so movement before then is a scroll we never touched.
   */
  const hold = useRef<{ timer: number | null; byThreshold: boolean }>({
    timer: null,
    byThreshold: false,
  });

  const clearHold = useCallback(() => {
    if (hold.current.timer !== null) window.clearTimeout(hold.current.timer);
    hold.current = { timer: null, byThreshold: false };
  }, []);

  /**
   * The row element, and where it was when the press landed.
   *
   * There is no ref to attach and no `label` prop to pass, because `rowProps` is
   * spread onto the row itself — so the capture handler's `currentTarget` *is*
   * the element being dragged. Measured once, at the press: reading the rect
   * again on the first move would read a row that has since been dimmed and, if
   * the list reflowed, moved.
   */
  const source = useRef<{
    element: HTMLElement;
    offset: { x: number; y: number };
    width: number;
  } | null>(null);

  /*
   * The live values, without re-binding the window listeners mid-gesture. A
   * gesture that re-registered its own `pointerup` half-way through would be one
   * `pointerup` away from listening to nothing.
   */
  const state = useRef({ self, setDragged, setOverId, find });
  useEffect(() => {
    state.current = { self, setDragged, setOverId, find };
  });

  /**
   * The row leaves the list.
   *
   * Shared, because the two devices reach it from opposite directions: a mouse
   * gets here from `pointermove` once it has travelled far enough, and a finger
   * gets here from the hold timer *without having moved at all*. That asymmetry
   * is deliberate — see `ROW_STYLE`. Starting the touch drag from the timer
   * rather than from the next move is what keeps the browser's pan unclaimed
   * until we are ready to `preventDefault` it.
   *
   * Defined below `state` rather than beside `clearHold`, and the React Compiler
   * is right to insist: a ref read inside a hook must not be written after that
   * hook, or the closure and the writer disagree about which is authoritative.
   */
  const begin = useCallback(() => {
    if (!origin.current || started.current) return;

    started.current = true;
    setIsDragging(true);
    state.current.setDragged(state.current.self);
  }, []);

  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent) => {
      if (!canDrag || event.button !== 0) return;

      /*
       * A press that started on one of the row's own controls is not a drag.
       *
       * The old hook stripped the `draggable` attribute off the row while the
       * pointer hovered a control, because with native DnD a child could not
       * cancel a `dragstart` raised on its draggable ancestor — and that
       * workaround then got stuck whenever `usePress` took pointer capture and
       * swallowed the `pointerleave` that would have cleared it. Owning the
       * gesture makes it one question asked once, at the press, about the element
       * actually under the pointer.
       */
      if (
        event.target instanceof Element &&
        event.target.closest("[data-no-drag]")
      ) {
        return;
      }

      const element = event.currentTarget as HTMLElement;
      const rect = element.getBoundingClientRect();

      source.current = {
        element,
        offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        width: rect.width,
      };

      origin.current = { x: event.clientX, y: event.clientY };
      latest.current = { x: event.clientX, y: event.clientY };
      started.current = false;

      clearHold();

      if (event.pointerType === "touch") {
        // `onPointerMove` cancels this if the finger travels first, which is
        // what lets a swipe scroll the panel instead of dragging a row.
        hold.current.timer = window.setTimeout(() => {
          hold.current.timer = null;
          begin();
        }, TOUCH_HOLD_MS);
      } else {
        hold.current.byThreshold = true;
      }
    },
    [canDrag, begin, clearHold],
  );

  /*
   * On the window, not the row. A drag ends wherever the pointer happens to be —
   * over another row, over the strip, off the edge of the panel — and a listener
   * on the row would only hear about the ones that came back to it.
   */
  useEffect(() => {
    /** What is under the pointer that would take this drop, if anything. */
    const targetAt = (x: number, y: number): string | null => {
      const element = document.elementFromPoint(x, y);
      const host = element?.closest<HTMLElement>("[data-drop-id]");
      const id = host?.dataset.dropId;
      if (!id) return null;

      const target = state.current.find(id);

      return target?.accepts(state.current.self) ? id : null;
    };

    const onPointerMove = (event: PointerEvent) => {
      const from = origin.current;
      if (!from) return;

      if (!started.current) {
        const travelled = Math.hypot(event.clientX - from.x, event.clientY - from.y);

        if (!hold.current.byThreshold) {
          /*
           * A finger that moved before its hold fired is scrolling, so the
           * gesture is over as far as we are concerned. Dropping `origin`
           * outright rather than merely not starting: a swipe that happens to
           * come to rest under the finger must not turn into a drag half a
           * second later, and a press that ends after a scroll must not fall
           * through to `finish`'s drop handling.
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

      // Stops the gesture from also scrolling the panel or selecting text. On
      // touch this is what takes the pan back from the browser, and it only
      // lands because the hold cancelled itself on any earlier movement.
      event.preventDefault();
      latest.current = { x: event.clientX, y: event.clientY };
      if (ghost.current) moveRowGhost(ghost.current, event.clientX, event.clientY);

      // Reaching a group that is scrolled out of the panel — see edge-autoscroll.
      autoScroll.current?.update(event.clientY);

      /*
       * The ghost sits under the pointer, so it would be the topmost element at
       * every sample and the answer would always be "nothing". It is
       * `pointer-events: none` in CSS, which is what keeps `elementFromPoint`
       * seeing the row underneath.
       */
      state.current.setOverId(targetAt(event.clientX, event.clientY));
    };

    const finish = (event: PointerEvent, drop: boolean) => {
      clearHold();
      if (!origin.current) return;

      const wasDragging = started.current;
      origin.current = null;
      started.current = false;
      setIsDragging(false);

      const { self: dragged, setDragged, setOverId, find } = state.current;
      setDragged(null);
      setOverId(null);

      if (!wasDragging || !drop) return;

      const id = targetAt(event.clientX, event.clientY);
      if (!id) return;

      const target = find(id);
      if (target?.accepts(dragged)) target.onDrop(dragged);
    };

    const onPointerUp = (event: PointerEvent) => finish(event, true);
    const onPointerCancel = (event: PointerEvent) => finish(event, false);

    /** Escape abandons a drag in progress, matching every other gesture here. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !origin.current) return;

      clearHold();
      origin.current = null;
      started.current = false;
      setIsDragging(false);
      state.current.setDragged(null);
      state.current.setOverId(null);
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
    // Both are `useCallback(_, [])`, so naming them here never re-binds the
    // listeners — which is the property the comment above depends on.
  }, [begin, clearHold]);

  /*
   * Everything that is only true while a row is in the air, set up and torn down
   * in one place.
   *
   * One effect rather than several, and the cleanup is the whole reason: a drop, a
   * drag that ended over nothing, an Escape and an unmount all have to put the
   * copy away, un-dim the row and give the page its cursor back. Four exits, one
   * path.
   *
   * The `grabbing` cursor is a class on `<body>` rather than an inline style,
   * because it has to beat the cursor of every element the pointer crosses — see
   * `body.is-row-dragging *` in app/globals.css. An inline cursor on `<body>` is
   * only inherited, so any button along the way overrode it.
   */
  useEffect(() => {
    const picked = source.current;
    if (!isDragging || !picked) return;

    const element = mountRowGhost(
      picked.element,
      latest.current.x,
      latest.current.y,
      picked.offset,
      picked.width,
    );
    ghost.current = element;

    /*
     * Set up here rather than in `begin` so it shares the one cleanup path: a
     * drop, a drag that ended over nothing, an Escape and an unmount all have to
     * stop the frame loop, and this effect is already the place that guarantees
     * that. Null on the Locations tab, where there is no scroller above the row.
     */
    const scroller = scrollableAncestor(picked.element);
    autoScroll.current = scroller ? startEdgeAutoScroll(scroller) : null;

    // The row stays in the list and fades, so nothing shifts under the pointer
    // while the user is aiming at a row further down.
    picked.element.classList.add("row-lifted");

    const { body } = document;
    const previousUserSelect = body.style.userSelect;
    body.classList.add("is-row-dragging");
    body.style.userSelect = "none";

    return () => {
      element.root.remove();
      ghost.current = null;
      autoScroll.current?.stop();
      autoScroll.current = null;
      picked.element.classList.remove("row-lifted");
      body.classList.remove("is-row-dragging");
      body.style.userSelect = previousUserSelect;
    };
  }, [isDragging]);

  return {
    /** True while this row is the one in the air. */
    isDragging,
    /** Spread onto the row element. */
    rowProps: {
      onPointerDownCapture,
      style: canDrag ? ROW_STYLE : undefined,
    },
    /** True while the row would actually pick up — what the cursor should say. */
    isDraggable: canDrag,
  };
}

/**
 * Somewhere a dragged row can land.
 *
 * The id is what `elementFromPoint` finds, so it has to be on the element too —
 * hence `targetProps`, which carries both it and the highlight flag the CSS keys
 * off. Registering and rendering the attribute in one hook is what stops the two
 * drifting apart into a target that lights up and does nothing.
 *
 * `accepts` is not a nicety. A row that cannot take this particular payload has
 * to be *skipped*, not merely refuse on release: without it, dragging a group
 * over its own members would light up every one of them on the way past.
 */
export function useDropTarget({
  id,
  accepts,
  onDrop,
}: {
  /** Unique within the panel. Prefixed by kind, since ids come from three tables. */
  id: string;
  accepts: (dragged: DraggedObject) => boolean;
  /** Omit and the element is not a target at all. */
  onDrop?: (dragged: DraggedObject) => void;
}) {
  const { overId, dragged, register } = useRowDragState();

  // Read through refs so the registration below survives a parent re-render
  // without tearing down and re-adding the entry mid-gesture.
  const handlers = useRef({ accepts, onDrop });
  useEffect(() => {
    handlers.current = { accepts, onDrop };
  });

  useEffect(() => {
    if (!onDrop) return;

    return register(id, {
      accepts: (object) => handlers.current.accepts(object),
      onDrop: (object) => handlers.current.onDrop?.(object),
    });
    // `onDrop` only for its presence — see the ref above for its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, register, Boolean(onDrop)]);

  const isTarget = Boolean(onDrop) && overId === id && dragged !== null;

  return {
    isTarget,
    targetProps: {
      "data-drop-id": onDrop ? id : undefined,
      "data-drop-target": isTarget || undefined,
    },
  };
}

/**
 * Spread on anything inside a row that is pressed rather than dragged.
 *
 * An attribute rather than pointer handlers: the source reads it off the press's
 * own target, so there is no hover state to get stuck — see the comment in
 * `onPointerDownCapture`.
 */
export const NO_DRAG_PROPS = { "data-no-drag": true } as const;
