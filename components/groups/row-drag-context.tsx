"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { DraggedObject } from "./use-row-drag";

/**
 * Which row is in the air right now.
 *
 * Native HTML5 drag-and-drop tells a *drop target* what is coming when the
 * pointer arrives over it, and tells nobody else anything. That is enough while
 * every target is a row that is already on screen, and not enough for the one
 * gesture that has no row to aim at: dragging something out of its group. The
 * place to drop it is a strip that should only exist while there is something to
 * drop — which means the panel has to know a drag started before the pointer gets
 * anywhere near it.
 *
 * A context rather than the editor store, because this is transient pointer state
 * that dies with the gesture, and `lib/stores/editor-store.ts` holds what the
 * editor *is* — its mode and its selection — not what a pointer is doing this
 * second.
 *
 * The default is a no-op so `useRowDrag` works with no provider above it. The
 * Locations tab (components/places/places-manager.tsx) renders rows with no
 * grouping at all and must not need one.
 */

type RowDragState = {
  dragged: DraggedObject | null;
  setDragged: (dragged: DraggedObject | null) => void;
};

const RowDragContext = createContext<RowDragState>({
  dragged: null,
  setDragged: () => {},
});

export function RowDragProvider({ children }: { children: ReactNode }) {
  const [dragged, setDragged] = useState<DraggedObject | null>(null);
  const value = useMemo(() => ({ dragged, setDragged }), [dragged]);

  return <RowDragContext value={value}>{children}</RowDragContext>;
}

export function useRowDragState(): RowDragState {
  return useContext(RowDragContext);
}
