import { create } from "zustand";

/**
 * Transient editor state — and nothing else.
 *
 * Maps and places live in the TanStack Query cache. Copying them here would give
 * us two sources of truth and a stale marker after every refetch.
 */

export type EditorMode = "browse" | "add";

export type Viewport = {
  lng: number;
  lat: number;
  zoom: number;
};

type EditorState = {
  mode: EditorMode;
  selectedPlaceId: string | null;
  viewport: Viewport | null;
  isSheetOpen: boolean;

  setMode: (mode: EditorMode) => void;
  toggleAddMode: () => void;
  selectPlace: (placeId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  setSheetOpen: (open: boolean) => void;
  reset: () => void;
};

const initialState = {
  mode: "browse" as EditorMode,
  selectedPlaceId: null,
  viewport: null,
  isSheetOpen: false,
};

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),
  toggleAddMode: () =>
    set((state) => ({ mode: state.mode === "add" ? "browse" : "add" })),
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  setViewport: (viewport) => set({ viewport }),
  setSheetOpen: (isSheetOpen) => set({ isSheetOpen }),
  reset: () => set(initialState),
}));

// Narrow selectors: a viewport change must not re-render the place list.
export const useEditorMode = () => useEditorStore((state) => state.mode);
export const useSelectedPlaceId = () =>
  useEditorStore((state) => state.selectedPlaceId);
