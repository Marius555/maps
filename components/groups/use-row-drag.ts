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
import { dropTargetAt } from "./drop-target-at";
import {
  createGhostMagnet,
  type GhostExit,
  type GhostMagnet,
} from "./ghost-magnet";
import { useRowDragState } from "./row-drag-context";
import { mountRowGhost } from "./row-drag-ghost";

/**
 * Dragging one row onto another to group them.
 *
 * **Pointer events, not HTML5 drag-and-drop.** This was native DnD, and four
 * event handlers is genuinely all it took — but two things it cannot do turned
 * out to matter more than the handful of lines it saved:
 *
 * - **It owns the cursor.** From `dragstart` onwards the browser paints its own,
 *   and the row's own drag cursor is simply ignored. So the gesture with the
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
 * How long a finished drag goes on refusing the click it leaves behind, in ms.
 *
 * A mouse raises that click straight after its `pointerup`, so the window only
 * has to outlast the release. A finger raises it from the tap gesture after
 * `touchend`, which can land a little later — and a finger that travelled raises
 * none at all, so this is also how long a genuine tap straight after a drag
 * would be ignored. Nobody lifts, aims and taps again inside it.
 */
const CLICK_AFTER_DRAG_MS = 300;

/**
 * Eats the one `click` a drag leaves behind.
 *
 * A press that picked something up and let it go is still, to the browser, a
 * press and a release, so a `click` follows on whatever the two have in common.
 * Nobody noticed until the card designer's empty image block became a drag
 * source: its whole surface is the `<label>` for a file input, so a drag let go
 * on it would open the OS file picker.
 *
 * Capture phase on the window, so it is refused before any element hears of it;
 * `once`, so it takes that one click and no other; and a timeout, so a drag that
 * left no click behind does not eat the next real one.
 */
function swallowNextClick(): void {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => {
    window.removeEventListener("click", swallow, { capture: true });
  }, CLICK_AFTER_DRAG_MS);
}

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
 *
 * **It stays 250 and the attempt to shorten it is worth recording, because the
 * number was never the bug.** Grouping by drag was reported as doing nothing
 * whatsoever on a phone, and it was not broken: measured in the browser, press
 * and move straight away and the ghost, the lift, the body class and the target
 * highlight are *all four* false — an early move is read as a scroll and ends
 * the gesture — while holding 320ms first lights the row the finger is over and
 * groups on release. The gesture worked and was simply unguessable, which is
 * what `PRESSING_CLASS` below fixes.
 *
 * 180ms was tried on top of that and reverted, because it collides with the
 * other end of the same dial. A tap is a press with no movement, so the only
 * thing separating "tap" from "pick up" is this timer, and at 180ms a
 * **motionless 230ms tap lifts a ghost** — measured; it lands on itself,
 * `dropAction` refuses it and nothing is grouped, but a row that jumps into the
 * air and back on a deliberate tap reads as a glitch. 230ms is an ordinary
 * slow tap. The platform agrees about the direction: Android and iOS both put
 * their own long press at 500ms, so 250 is already half of what a user's phone
 * has taught them, and the flick this has to survive is ruled out by *travel*
 * in `onPointerMove` rather than by time.
 */
const TOUCH_HOLD_MS = 250;

/**
 * What the row wears while a finger is resting on it and the hold is building.
 *
 * Announcing the hold is the whole of the fix, because a gesture nobody can
 * discover is a gesture nobody has — see `TOUCH_HOLD_MS`, which was left where
 * it was once this existed. The rule
 * is in app/globals.css and is deliberately transform-only: this fires under a
 * finger, in the longest list in the app, and anything that touched the box
 * would reflow every row below it at the moment the user is aiming at one.
 *
 * Applied by hand rather than through React state, for the reason
 * `row-lifted` already is: a press must not re-render the panel it is on.
 */
const PRESSING_CLASS = "row-pressing";

/**
 * `pan-y`, not `none`.
 *
 * `none` hands every gesture to us, including the swipe someone meant as a
 * scroll — every row would be a dead spot and the panel could not be scrolled by
 * finger at all. `pan-y` promises the browser the vertical pan, and the hold
 * above is what decides who gets this one: movement first is a scroll, stillness
 * first is a drag.
 *
 * **What takes the pan back is not this property.** `touch-action` is resolved
 * at the start of a touch sequence and cannot be renegotiated mid-gesture, so
 * the claim is made by a non-passive `touchmove` instead — see `rowRef`, which
 * also records the long-standing mistake this sentence replaces.
 */
const ROW_STYLE: CSSProperties = {
  touchAction: "pan-y",
  /*
   * The hold's duration, handed to the stylesheet rather than repeated in it.
   *
   * `.row-pressing` describes this timer, so the two drifting apart would mean a
   * cue that finishes before the drag starts or keeps going after it has — and
   * the one place that knows the number is the constant above.
   */
  ["--row-hold" as string]: `${String(TOUCH_HOLD_MS)}ms`,
  /*
   * And `user-select: none` with it, which is not cosmetic.
   *
   * A row is mostly text, and on Android a long press on selectable text raises
   * the OS selection callout — which the browser announces by firing
   * `pointercancel`. That lands at roughly 500ms, a quarter of a second *after*
   * the hold above has started a drag, so the press that most obviously was one
   * is the press that died. `body.style.userSelect` was already being set, but
   * only from `begin()` onwards, which is far too late to retract something the
   * browser decided at `pointerdown`.
   *
   * `designer-block.tsx` has carried `select-none` for exactly this reason since
   * it was written. This is that rule, finally applied to the rows as well.
   *
   * The cost is that an address in the editor sidebar can no longer be selected
   * with a mouse. The Locations *tab* is untouched — `canDrag` is false there,
   * so none of this style is applied at all.
   */
  userSelect: "none",
  WebkitUserSelect: "none",
  /*
   * And `-webkit-touch-callout` with both of them, because it refuses the other
   * half of the same long press: not the text selection above but the
   * press-and-hold preview menu. Either one firing ends in `pointercancel`.
   *
   * A property rather than the window `contextmenu` listener further down,
   * because that one is only bound for the length of a drag — and the press this
   * has to survive is the 250ms *before* there is a drag to bind it from.
   */
  WebkitTouchCallout: "none",
};

/**
 * What is in the air.
 *
 * The first four are rows of the locations panel. The last two are the card
 * designer, which runs this same gesture rather than a second one: the threshold,
 * the 250ms touch hold, the ghost, Escape-to-abort and the edge autoscroll are
 * all things that took real work to get right, and a designer that felt different
 * from the list would be a second set of them to keep in step.
 *
 * Nothing else in this file reads `type` — it is carried to the drop target and
 * interpreted there.
 */
export type DraggedObject = {
  type:
    | "place"
    | "shape"
    | "group"
    /**
     * One stop of a route, being reordered within it. `id` is
     * `<shapeId>:<index>`, because a stop has no id of its own — the order
     * *is* the membership (lib/map/sidebar-rows.ts), and a round trip visits
     * one location twice.
     *
     * Added to this union rather than changing the `accepts`/`onDrop`
     * contract, which the card designer shares: a reorder needs to know which
     * half of a row the pointer is in, and the answer was two registered
     * targets per row rather than a third argument for every target in the
     * app. See components/map/routes/route-stop-list-item.tsx.
     */
    | "route-stop"
    /** A block being moved on the card. `id` is the block's id. */
    | "card-block"
    /** A block being dragged off the palette. `id` is the block *type*. */
    | "card-new";
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
  onDroppedOutside,
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
  /**
   * Released over nothing registered at all — not a target that refused the
   * drop, a release point with no drop target beneath it whatsoever.
   *
   * Omit and a drop like that simply does nothing, which is every row's
   * behaviour today. The card designer wires this on a placed block to remove
   * it, which only reads correctly once the card itself is *also* a
   * registered target (see the catch-all in card-canvas.tsx) — otherwise a
   * sloppy-but-still-over-the-card drop would count as "outside" too.
   */
  onDroppedOutside?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const { setDragged, setOverId, find, snapFor } = useRowDragState();

  const origin = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ x: 0, y: 0 });
  const started = useRef(false);
  /**
   * What the pointer was last over, as a ref rather than as the state below.
   *
   * `pointercancel` has to decide whether the drag it is ending had a promise on
   * screen, and the window listeners are bound once — reading `overId` from the
   * context there would read whatever it was when they were bound. This is
   * written in the same breath as `setOverId`, so the two cannot disagree.
   */
  const lastOver = useRef<string | null>(null);
  /**
   * The copy in the hand, and whatever pulls it onto a place it could land —
   * see ghost-magnet.ts. With no surface pulling it is `moveRowGhost`, exactly.
   */
  const magnet = useRef<GhostMagnet | null>(null);
  /**
   * How that copy leaves when the gesture ends. Written by `finish`, and read by
   * the drag-lifetime effect's cleanup, which runs after it in the commit the
   * gesture ending causes.
   */
  const exit = useRef<GhostExit>("remove");
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

  /**
   * The row currently wearing `PRESSING_CLASS`, so it can be taken off again.
   *
   * Its own ref rather than reading `source.current.element`, and declared up
   * here rather than beside that one, for the rule `begin` records below: a ref
   * read inside a hook must not be written after that hook, or the closure and
   * the writer disagree about which is authoritative.
   */
  const pressing = useRef<HTMLElement | null>(null);

  const releasePress = useCallback(() => {
    pressing.current?.classList.remove(PRESSING_CLASS);
    pressing.current = null;
  }, []);

  /*
   * Takes the press cue off with the timer, which is what makes it correct at
   * all four exits: the finger travelled and this is a scroll, the drop landed,
   * Escape abandoned, the pointer was cancelled. Every one of them already came
   * through here.
   *
   * Stable, because `releasePress` is — which the window-listener effect below
   * depends on: naming `clearHold` in its deps must never re-bind those
   * listeners mid-gesture.
   */
  const clearHold = useCallback(() => {
    if (hold.current.timer !== null) window.clearTimeout(hold.current.timer);
    hold.current = { timer: null, byThreshold: false };
    releasePress();
  }, [releasePress]);

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
    /**
     * The row's own box, so the ghost is the size of what was picked up.
     *
     * Both dimensions, not just the width: a card block sizes itself against its
     * parent (a percentage width, a flex basis), and a clone of it appended to
     * `<body>` resolves those against something else entirely — see
     * `mountRowGhost`.
     */
    size: { width: number; height: number };
  } | null>(null);

  /*
   * The live values, without re-binding the window listeners mid-gesture. A
   * gesture that re-registered its own `pointerup` half-way through would be one
   * `pointerup` away from listening to nothing.
   */
  const state = useRef({
    self,
    setDragged,
    setOverId,
    find,
    snapFor,
    onDroppedOutside,
  });
  useEffect(() => {
    state.current = {
      self,
      setDragged,
      setOverId,
      find,
      snapFor,
      onDroppedOutside,
    };
  });

  /**
   * The row leaves the list.
   *
   * Shared, because the two devices reach it from opposite directions: a mouse
   * gets here from `pointermove` once it has travelled far enough, and a finger
   * gets here from the hold timer *without having moved at all*. That asymmetry
   * is deliberate — see `ROW_STYLE`. Starting the touch drag from the timer
   * rather than from the next move is what keeps the browser's pan unclaimed
   * until `rowRef`'s `touchmove` is ready to refuse it: `started` is what that
   * listener reads, and it is set here.
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
        size: { width: rect.width, height: rect.height },
      };

      origin.current = { x: event.clientX, y: event.clientY };
      latest.current = { x: event.clientX, y: event.clientY };
      started.current = false;

      clearHold();

      /*
       * The whole row is the drag source on every device, and touch is the only
       * one that has to wait.
       *
       * There was a grip here for a while — a glyph carrying `touch-action:
       * none`, which skipped this hold — and it was a workaround for a bug that
       * is fixed in `rowRef` instead. A row is what the user is aiming at, so a
       * row is what picks up.
       */
      if (event.pointerType === "touch") {
        /*
         * Touch is the one device that has to wait, so it is the one that gets
         * told it is waiting — see `PRESSING_CLASS`. A mouse has nothing to
         * announce: its drag begins on the 8px it has already travelled, and a
         * press cue on every row click would be a new animation charged to
         * every selection in the panel.
         */
        element.classList.add(PRESSING_CLASS);
        pressing.current = element;

        // `onPointerMove` cancels this if the finger travels first, which is
        // what lets a swipe scroll the panel instead of dragging a row.
        hold.current.timer = window.setTimeout(() => {
          hold.current.timer = null;
          // The cue has said what it had to say; the ghost and `row-lifted`
          // take over from here, and leaving a scale on the row underneath
          // would be two answers to the same question.
          releasePress();
          begin();
        }, TOUCH_HOLD_MS);
      } else {
        hold.current.byThreshold = true;
      }
    },
    [canDrag, begin, clearHold, releasePress],
  );

  /*
   * On the window, not the row. A drag ends wherever the pointer happens to be —
   * over another row, over the strip, off the edge of the panel — and a listener
   * on the row would only hear about the ones that came back to it.
   */
  useEffect(() => {
    /** What is under the pointer that would take this drop, if anything. */
    const targetAt = (x: number, y: number): string | null =>
      dropTargetAt(state.current.find, state.current.self, x, y);

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

      /*
       * Stops the gesture also selecting text and raising the mouse-compatibility
       * events behind it.
       *
       * **It is not what stops the panel scrolling**, and reading it as though it
       * were cost this file a great deal — a pointer event's default action
       * cannot be prevented for a pan, on any engine. `rowRef` is where that
       * happens.
       *
       * Guarded, because once the browser has committed to a pan it marks every
       * move non-cancelable and logs a warning per sample — sixty a second, in
       * the one console you most need to read while diagnosing a lost drag.
       */
      if (event.cancelable) event.preventDefault();
      latest.current = { x: event.clientX, y: event.clientY };

      // Reaching a group that is scrolled out of the panel — see edge-autoscroll.
      // `clientX` as well as `clientY`, or the pull's band is an infinite
      // horizontal strip and a drag held anywhere near the top of the window
      // scrolls a panel it is nowhere near.
      autoScroll.current?.update(event.clientY, event.clientX);

      /*
       * The ghost sits under the pointer, so it would be the topmost element at
       * every sample and the answer would always be "nothing". It is
       * `pointer-events: none` in CSS, which is what keeps `elementFromPoint`
       * seeing the row underneath.
       */
      const over = targetAt(event.clientX, event.clientY);
      lastOver.current = over;
      state.current.setOverId(over);

      /*
       * The copy goes under the pointer — or, where the surface under it pulls,
       * onto the place it would land (ghost-magnet.ts). After the hit test
       * rather than before it: safe, because the copy is not part of the hit
       * test (above), and necessary, because the target is what decides where
       * the copy is drawn.
       */
      magnet.current?.follow(
        event.clientX,
        event.clientY,
        over,
        state.current.snapFor(over),
      );
    };

    const finish = (x: number, y: number, drop: boolean) => {
      clearHold();
      if (!origin.current) return;

      const wasDragging = started.current;
      origin.current = null;
      started.current = false;
      lastOver.current = null;
      setIsDragging(false);

      // Whatever the drag ended on, the press that began it was not a click.
      if (wasDragging) swallowNextClick();

      const { self: dragged, setDragged, setOverId, find, onDroppedOutside } =
        state.current;
      setDragged(null);
      setOverId(null);

      if (!wasDragging || !drop) return;

      const id = targetAt(x, y);
      if (!id) {
        onDroppedOutside?.();
        return;
      }

      const target = find(id);
      if (!target?.accepts(dragged)) return;

      // Landed while the copy was sitting on its slot: it fades into the block
      // appearing under it, rather than vanishing a frame before that block
      // exists. Every other ending removes it at once, as it always did.
      if (magnet.current?.isSnapped()) exit.current = "settle";
      target.onDrop(dragged);
    };

    const onPointerUp = (event: PointerEvent) =>
      finish(event.clientX, event.clientY, true);

    /**
     * A cancelled pointer, and what it means depends on whether a drag had begun.
     *
     * *Before* one, it is the browser taking a swipe it was always allowed to
     * take — a scroll. There is nothing to undo and nothing to land.
     *
     * *After* one it is an interruption rather than a decision: a system
     * edge-swipe, an incoming call, or an OS callout that got through the
     * refusals above. Throwing the gesture away there throws away aim the user
     * had already taken, so a cancel **over a lit target** completes as a drop —
     * the highlight was the promise, and it was drawn from this same coordinate
     * — while a cancel over nothing abandons, which is what releasing over
     * nothing already does.
     *
     * Its own coordinates are not trusted: `pointercancel` is spec'd to carry
     * the last known position, and engines disagree about what that means.
     * `latest` is ours and is written on every move.
     *
     * It always *ends* the gesture either way. No further move or up is
     * delivered for a cancelled pointer, so a drag kept alive here would be a
     * ghost stuck under a finger that has already left the glass.
     */
    const onPointerCancel = () =>
      finish(
        latest.current.x,
        latest.current.y,
        started.current && lastOver.current !== null,
      );

    /** Escape abandons a drag in progress, matching every other gesture here. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !origin.current) return;

      // The press is still down, and letting it go leaves a click behind like
      // any other drag's ending — see `swallowNextClick`.
      if (started.current) {
        window.addEventListener("pointerup", swallowNextClick, { once: true });
      }

      clearHold();
      origin.current = null;
      started.current = false;
      lastOver.current = null;
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
      // A row unmounted mid-press never gets its `pointerup`. The node is going
      // anyway, so this is about not holding a reference to a detached one.
      releasePress();
    };
    // All three are `useCallback(_, [])` or built from ones that are, so naming
    // them here never re-binds the listeners — which is the property the comment
    // above depends on.
  }, [begin, clearHold, releasePress]);

  /*
   * Everything that is only true while a row is in the air, set up and torn down
   * in one place.
   *
   * One effect rather than several, and the cleanup is the whole reason: a drop, a
   * drag that ended over nothing, an Escape and an unmount all have to put the
   * copy away, un-dim the row and give the page its cursor back. Four exits, one
   * path.
   *
   * The drag cursor is a class on `<body>` rather than an inline style,
   * because it has to beat the cursor of every element the pointer crosses — see
   * `body.is-row-dragging *` in app/globals.css. An inline cursor on `<body>` is
   * only inherited, so any button along the way overrode it.
   */
  useEffect(() => {
    const picked = source.current;
    if (!isDragging || !picked) return;

    const copy = mountRowGhost(
      picked.element,
      latest.current.x,
      latest.current.y,
      picked.offset,
      picked.size,
    );
    const pull = createGhostMagnet(
      copy,
      picked.size,
      latest.current.x,
      latest.current.y,
    );
    magnet.current = pull;

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

    /*
     * Android raises its selection callout about 500ms after a finger lands and
     * announces it by cancelling the pointer — which used to end a drag that had
     * begun 250ms earlier. Refusing the menu is what stops the cancel.
     *
     * On the window and only for the length of the gesture, so a right-click
     * anywhere else in the app still opens the browser's own menu. The 250ms
     * before there is a drag to bind this from is covered declaratively instead,
     * by `-webkit-touch-callout` in `ROW_STYLE`.
     */
    const onContextMenu = (event: Event) => event.preventDefault();
    window.addEventListener("contextmenu", onContextMenu);

    const { body } = document;
    const previousUserSelect = body.style.userSelect;
    body.classList.add("is-row-dragging");
    body.style.userSelect = "none";

    return () => {
      // Faded into the block it landed as, or gone this frame — `exit`, which
      // `finish` has already written by the time this runs.
      pull.dispose(exit.current);
      exit.current = "remove";
      magnet.current = null;
      autoScroll.current?.stop();
      autoScroll.current = null;
      picked.element.classList.remove("row-lifted");
      window.removeEventListener("contextmenu", onContextMenu);
      body.classList.remove("is-row-dragging");
      body.style.userSelect = previousUserSelect;
    };
  }, [isDragging]);

  /**
   * The row element, carrying the one listener that can actually stop a scroll.
   *
   * **`preventDefault()` on a pointer event does not prevent panning.** The
   * Pointer Events spec says so outright, and this hook believed otherwise for a
   * long time: the 250ms hold was written to claim the pan by preventing the
   * first `pointermove` after it fired, which is a no-op on every engine. On
   * Android the compositor then took the scroll `pan-y` had promised it, marked
   * every later move `cancelable: false`, and finished with a `pointercancel` —
   * and the symptom was "the row does not move", with nothing in the console.
   *
   * A grip carrying `touch-action: none` was the first answer, and it did work —
   * it just answered a narrower question than the one being asked, by moving the
   * gesture onto 32px of glyph instead of fixing the row. Two sibling hooks are
   * the tell that the lever was always declarative: `use-chip-reorder.ts` has the
   * identical hold and has never had this bug, because a chip drags
   * *horizontally* and `pan-y` refuses that axis outright; `use-drag-to-add.ts`
   * has never had it either, because it is `touch-action: none` with no hold.
   *
   * `touch-action` is the only declarative lever and a non-passive `touchmove` is
   * the only imperative one. So the pan is claimed here, and three things about
   * how follow from the platform rather than from taste:
   *
   * - **`addEventListener`, not React's `onTouchMove`.** React registers
   *   `touchstart`, `touchmove` and `wheel` at its root *passively*, so a JSX
   *   handler cannot call `preventDefault` at all.
   * - **Bound at mount, not when the drag begins.** Chrome decides whether a
   *   scroll may go straight to the compositor by looking for blocking listeners
   *   at hit-test time, so one added mid-gesture does not apply to the gesture
   *   already running. It cannot live in the drag effect above.
   * - **Only where `canDrag`.** A blocking listener costs the first move of every
   *   touch scroll a main-thread round trip. The Locations tab cannot drag at all
   *   and is the longest list in the app, so it keeps a fully composited scroll.
   *
   * Nothing is refused before `begin()` has run, which is what leaves a swipe to
   * the browser — momentum and all — and makes stillness the thing that decides.
   *
   * The element is detached by hand on the `null` call rather than by returning a
   * cleanup: `rowProps` is spread onto a `motion.div` in two places, and a ref
   * that only a React 19 renderer knows how to clean up would leak a listener
   * per row through anything that composes refs itself.
   */
  const onTouchMove = useCallback((event: TouchEvent) => {
    if (!started.current) return;
    if (event.cancelable) event.preventDefault();
  }, []);

  const bound = useRef<HTMLElement | null>(null);

  const rowRef = useCallback(
    (element: HTMLElement | null) => {
      if (bound.current) {
        bound.current.removeEventListener("touchmove", onTouchMove);
        bound.current = null;
      }

      if (!element || !canDrag) return;

      element.addEventListener("touchmove", onTouchMove, { passive: false });
      bound.current = element;
    },
    [canDrag, onTouchMove],
  );

  return {
    /** True while this row is the one in the air. */
    isDragging,
    /**
     * Spread onto the row element, and onto *one* element — the whole of it is
     * the drag source, so the capture handler's `currentTarget` is what gets
     * measured, lifted and drawn as the ghost.
     */
    rowProps: {
      ref: rowRef,
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
  /*
   * Would take this drop, whether or not the pointer is over it yet.
   *
   * The locations panel has no use for this — a row highlights only under the
   * pointer — but the card designer does: the moment a block leaves the palette,
   * every zone that could hold it outlines itself, so the answer to "where can
   * this go" is on screen before the first guess rather than after it.
   */
  const isCandidate = Boolean(onDrop) && dragged !== null && accepts(dragged);

  return {
    isTarget,
    isCandidate,
    targetProps: {
      "data-drop-id": onDrop ? id : undefined,
      "data-drop-target": isTarget || undefined,
      "data-drop-candidate": isCandidate || undefined,
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
