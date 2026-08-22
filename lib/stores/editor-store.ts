import { create } from "zustand";

/**
 * Transient editor state — and nothing else.
 *
 * Maps and places live in the TanStack Query cache. Copying them here would give
 * us two sources of truth and a stale marker after every refetch.
 */

import type { ShapeKind } from "@/packages/shared/shapes";

/**
 * What the next click on the map means.
 *
 * "add" drops a pin. The draw modes hand every click to a shape tool instead —
 * see components/map/shapes. They are separate values rather than one "draw"
 * plus a kind, because a mode is a thing you can be *in* and the tools read
 * clicks completely differently: the circle is a drag, the other two are
 * sequences. Written as a template over `ShapeKind` so a new tool is a new kind
 * and nothing else — the old spelled-out union quietly accepted a third tool
 * with no mode to put it in.
 *
 * "select" hands the drag to the marquee instead — see
 * components/map/select-box. It is a mode for the same reason the others are:
 * while it is on, a drag stops panning the map.
 */
export type EditorMode = "browse" | "add" | `draw-${ShapeKind}` | "select";

export type Viewport = {
  lng: number;
  lat: number;
  zoom: number;
};

/**
 * Several objects picked at once — by the marquee, or by clicking a group.
 *
 * Ids rather than objects, for the reason this whole file gives: the places and
 * shapes themselves live in the query cache, and a copy here would be stale the
 * moment one of them is renamed.
 *
 * Separate from `selectedPlaceId`/`selectedShapeId`, which mean "this one thing
 * has a card open". A multi-selection has no card; it has a count and an action
 * bar.
 */
export type Selection = {
  placeIds: string[];
  shapeIds: string[];
};

const EMPTY_SELECTION: Selection = { placeIds: [], shapeIds: [] };

export function isSelectionEmpty(selection: Selection): boolean {
  return selection.placeIds.length === 0 && selection.shapeIds.length === 0;
}

export function selectionSize(selection: Selection): number {
  return selection.placeIds.length + selection.shapeIds.length;
}

type EditorState = {
  mode: EditorMode;
  /**
   * The icon the next pin will wear, or "" for a plain one.
   *
   * Held beside the mode rather than inside it because it outlives a single
   * placement: picking "Café" and dropping six of them should not mean choosing
   * the icon six times. Cleared by `reset`, along with the mode itself.
   */
  addIcon: string;
  selectedPlaceId: string | null;
  selectedShapeId: string | null;
  /** Everything the marquee or a group click has picked out. */
  selection: Selection;
  viewport: Viewport | null;
  isSheetOpen: boolean;

  setMode: (mode: EditorMode) => void;
  /** Arm add mode with an icon — what pressing a tile in the add menu does. */
  startAdding: (icon: string) => void;
  /** Arm a drawing tool — what pressing an item in the shapes menu does. */
  startDrawing: (kind: ShapeKind) => void;
  /** Arm the marquee — what pressing the select tool does. */
  startSelecting: () => void;
  selectPlace: (placeId: string | null) => void;
  selectShape: (shapeId: string | null) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  setViewport: (viewport: Viewport) => void;
  setSheetOpen: (open: boolean) => void;
  reset: () => void;
};

const initialState = {
  mode: "browse" as EditorMode,
  addIcon: "",
  selectedPlaceId: null,
  selectedShapeId: null,
  selection: EMPTY_SELECTION,
  viewport: null,
  isSheetOpen: false,
};

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),
  startAdding: (addIcon) => set({ mode: "add", addIcon }),
  /*
   * Arming a tool drops whatever was selected.
   *
   * A selection is what puts a card on the map, and a card is 256px of the map
   * a drawing gesture cannot reach — see the note on `place` in
   * map-canvas-impl.tsx. The canvas hides the card while a tool is armed, but
   * clearing the id is what stops the sidebar row staying lit for something the
   * user has stopped looking at, and what makes the card's return after the
   * gesture a decision rather than a leftover.
   */
  startDrawing: (kind) =>
    set({
      mode: `draw-${kind}`,
      selectedPlaceId: null,
      selectedShapeId: null,
      selection: EMPTY_SELECTION,
    }),
  startSelecting: () => set({ mode: "select" }),

  /*
   * Selecting one clears the other. Two cards would open on top of each other at
   * roughly the same point on the map, and only one of them would be about what
   * the user just clicked.
   *
   * Both also drop the multi-selection, because clicking one object is how every
   * editor says "just this one now". Leaving a marquee's highlight up behind an
   * open card would make the Group button act on things the user had moved on
   * from.
   */
  selectPlace: (selectedPlaceId) =>
    set(
      selectedPlaceId === null
        ? { selectedPlaceId, selection: EMPTY_SELECTION }
        : {
            selectedPlaceId,
            selectedShapeId: null,
            selection: EMPTY_SELECTION,
          },
    ),
  selectShape: (selectedShapeId) =>
    set(
      selectedShapeId === null
        ? { selectedShapeId, selection: EMPTY_SELECTION }
        : {
            selectedShapeId,
            selectedPlaceId: null,
            selection: EMPTY_SELECTION,
          },
    ),

  /*
   * A marquee replaces both single selections for the mirror-image reason: the
   * card is about one object, and it would be describing something the new
   * selection may not even contain.
   */
  setSelection: (selection) =>
    set({ selection, selectedPlaceId: null, selectedShapeId: null }),
  clearSelection: () => set({ selection: EMPTY_SELECTION }),

  setViewport: (viewport) => set({ viewport }),
  setSheetOpen: (isSheetOpen) => set({ isSheetOpen }),
  reset: () => set(initialState),
}));

// Narrow selectors: a viewport change must not re-render the place list.
export const useEditorMode = () => useEditorStore((state) => state.mode);
export const useSelectedPlaceId = () =>
  useEditorStore((state) => state.selectedPlaceId);

/**
 * Which shape tool is armed, or null.
 *
 * Derived rather than stored, so the mode stays the single answer to "what does
 * a click do" — a second field saying the same thing is a second field to forget
 * to clear.
 */
export function drawKindOf(mode: EditorMode): ShapeKind | null {
  if (mode === "draw-circle") return "circle";
  if (mode === "draw-polygon") return "polygon";
  if (mode === "draw-line") return "line";
  return null;
}
