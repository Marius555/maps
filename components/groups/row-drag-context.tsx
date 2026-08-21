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

type RowDragState = {
  /** The object being dragged, or null. */
  dragged: DraggedObject | null;
  /** Which registered target the pointer is over, or null. */
  overId: string | null;
  setDragged: (dragged: DraggedObject | null) => void;
  setOverId: (id: string | null) => void;
  /** Returns the unregister function. */
  register: (id: string, target: DropTarget) => () => void;
  find: (id: string) => DropTarget | undefined;
};

const NOOP_STATE: RowDragState = {
  dragged: null,
  overId: null,
  setDragged: () => {},
  setOverId: () => {},
  register: () => () => {},
  find: () => undefined,
};

const RowDragContext = createContext<RowDragState>(NOOP_STATE);

export function RowDragProvider({ children }: { children: ReactNode }) {
  const [dragged, setDragged] = useState<DraggedObject | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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

  const value = useMemo(
    () => ({ dragged, overId, setDragged, setOverId, register, find }),
    [dragged, overId, register, find],
  );

  return <RowDragContext value={value}>{children}</RowDragContext>;
}

export function useRowDragState(): RowDragState {
  return useContext(RowDragContext);
}
