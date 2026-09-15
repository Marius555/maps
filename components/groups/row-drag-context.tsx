"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { DraggedObject } from "./use-row-drag";
import { useTapCarry } from "./use-tap-carry";

/**
 * What is in the air, and what it is currently over.
 *
 * The gesture is pointer-driven (see `use-row-drag.ts`), which means nothing
 * tells a drop target that a pointer carrying a row has arrived — there is no
 * `dragover`, because there is no browser drag. So the targets publish
 * *themselves* here, keyed by id, and the one hook running the gesture looks up
 * whichever is under the pointer and lights it.
 *
 * That indirection buys the thing HTML5 drag-and-drop could not give us at all:
 * the strip for dropping something out of its group has to exist *before* the
 * pointer reaches it, which means the panel has to know a drag started while it
 * is still happening somewhere else entirely.
 *
 * Two halves, deliberately split:
 *
 * - **State** (`dragged`, `overId`) re-renders its readers, which is the point —
 *   a row lights up, the strip appears. It changes a handful of times per
 *   gesture, not per pointer sample.
 * - **The registry** is a ref, and never re-renders anything. A target
 *   registering itself must not be a render, or mounting the strip mid-drag
 *   would re-render the panel underneath the pointer.
 *
 * A context rather than the editor store, because this is transient pointer state
 * that dies with the gesture, and `lib/stores/editor-store.ts` holds what the
 * editor *is* — its mode and its selection — not what a pointer is doing this
 * second.
 *
 * The default is a working no-op so `useRowDrag` needs no provider above it. The
 * Locations tab (components/places/places-manager.tsx) renders rows with no
 * grouping at all and must not need one.
 */

/** What a target does with a drop, and whether it wants this particular payload. */
export type DropTarget = {
  onDrop: (dragged: DraggedObject) => void;
  /** False and the pointer passes straight over it — see `useDropTarget`. */
  accepts: (dragged: DraggedObject) => boolean;
};

/**
 * Where the copy in the hand should sit instead of under the pointer, in
 * viewport px — see `components/groups/ghost-magnet.ts`.
 *
 * A *drawing* answer and never a hit-testing one: the drop is still resolved
 * from the pointer (`elementFromPoint` in use-row-drag.ts), and the ghost is
 * `pointer-events: none`, so where it is drawn cannot change where a release
 * lands.
 */
export type SnapBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  /**
   * How the copy sits in the box. `"block"` when the copy *is* the thing
   * landing (a block moved on the card): it is laid out at the box's size and
   * shrunk just inside it. `"label"` for a palette tile, which only stands for
   * the block: it sheds its pill, keeps its own size and is centred, shrunk only
   * as far as the box needs.
   */
  fit: "block" | "label";
};

/** Which box a target id pulls the ghost into — null lets it follow the pointer. */
export type SnapResolver = (id: string) => SnapBox | null;

/**
 * How the object in the air got there: `"drag"` for a press that moved
 * (use-row-drag.ts), `"tap"` for a click that picked it up and is waiting for a
 * second click to put it down (use-tap-carry.ts).
 */
export type CarriedBy = "drag" | "tap";

type RowDragState = {
  /** The object being dragged, or null. */
  dragged: DraggedObject | null;
  /**
   * How `dragged` got into the air, or null when nothing is.
   *
   * Every reader of `dragged` treats the two alike — the drop areas light, the
   * sheet parks — and only what ends a carry needs to know which it is.
   */
  carriedBy: CarriedBy | null;
  /** Which registered target the pointer is over, or null. */
  overId: string | null;
  /** For a gesture. `null` ends a *drag* and nothing else — see the provider. */
  setDragged: (dragged: DraggedObject | null) => void;
  /**
   * Pick `object` up with a click, or put a click-carried one down. `null` ends
   * a *tap* carry and nothing else.
   */
  tap: (object: DraggedObject | null) => void;
  setOverId: (id: string | null) => void;
  /** Returns the unregister function. */
  register: (id: string, target: DropTarget) => () => void;
  find: (id: string) => DropTarget | undefined;
  /**
   * Lets one surface pull the ghost onto its targets. Returns the unregister
   * function. **Opt-in**: with nothing registered `snapFor` is always null and
   * the ghost follows the pointer exactly as it always has.
   */
  registerSnap: (resolver: SnapResolver) => () => void;
  snapFor: (id: string | null) => SnapBox | null;
};

const NOOP_STATE: RowDragState = {
  dragged: null,
  carriedBy: null,
  overId: null,
  setDragged: () => {},
  tap: () => {},
  setOverId: () => {},
  register: () => () => {},
  find: () => undefined,
  registerSnap: () => () => {},
  snapFor: () => null,
};

const RowDragContext = createContext<RowDragState>(NOOP_STATE);

export function RowDragProvider({ children }: { children: ReactNode }) {
  const [carry, setCarry] = useState<{
    object: DraggedObject;
    by: CarriedBy;
  } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const dragged = carry?.object ?? null;
  const carriedBy = carry?.by ?? null;

  /*
   * **A gesture's `null` ends a drag, never a tap carry — and that guard is what
   * click-to-place stands on.** `finish()` in use-row-drag.ts calls
   * `setDragged(null)` on every pointerup that followed a press, including a
   * press that never became a drag: a plain click on a palette tile. Unguarded,
   * clicking the tile that is already carried, to put it back, ended the carry
   * at pointerup and picked it straight up again on the click that followed.
   *
   * A gesture that really *starts* still replaces a tap carry — that is somebody
   * picking up something else — and `tap(null)` is guarded the other way round,
   * so neither kind of ending can take down the other kind of carry.
   */
  const setDragged = useCallback((object: DraggedObject | null) => {
    setCarry((current) =>
      object ? { object, by: "drag" } : current?.by === "drag" ? null : current,
    );
  }, []);

  const tap = useCallback((object: DraggedObject | null) => {
    setCarry((current) =>
      object ? { object, by: "tap" } : current?.by === "tap" ? null : current,
    );
  }, []);

  const targets = useRef(new Map<string, DropTarget>());

  const register = useCallback((id: string, target: DropTarget) => {
    targets.current.set(id, target);

    return () => {
      // Only if it is still ours. A row that unmounts *after* its replacement
      // registered under the same id would otherwise delete the live one — which
      // is exactly what a row moving between groups does under `AnimatePresence`.
      if (targets.current.get(id) === target) targets.current.delete(id);
    };
  }, []);

  const find = useCallback((id: string) => targets.current.get(id), []);

  /*
   * A ref for the registry's reason: the resolver is asked on every pointer
   * sample, and re-registering it must never be a render.
   */
  const snap = useRef<SnapResolver | null>(null);

  const registerSnap = useCallback((resolver: SnapResolver) => {
    snap.current = resolver;

    return () => {
      // Only if it is still ours — a layer leaving under `AnimatePresence` can
      // unmount after the next gesture's layer has registered.
      if (snap.current === resolver) snap.current = null;
    };
  }, []);

  const snapFor = useCallback(
    (id: string | null) => (id && snap.current ? snap.current(id) : null),
    [],
  );

  /*
   * What ends a tap carry — a click on a place, a click anywhere else, Escape.
   * Bound only while there is one, so a drag, and every surface that never taps,
   * pays nothing for it.
   */
  useTapCarry({
    carried: carriedBy === "tap" ? dragged : null,
    find,
    setOverId,
    tap,
  });

  const value = useMemo(
    () => ({
      dragged,
      carriedBy,
      overId,
      setDragged,
      tap,
      setOverId,
      register,
      find,
      registerSnap,
      snapFor,
    }),
    [
      dragged,
      carriedBy,
      overId,
      setDragged,
      tap,
      register,
      find,
      registerSnap,
      snapFor,
    ],
  );

  return <RowDragContext value={value}>{children}</RowDragContext>;
}

export function useRowDragState(): RowDragState {
  return useContext(RowDragContext);
}
