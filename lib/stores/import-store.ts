import { create } from "zustand";

import type { ColumnMapping } from "@/lib/csv/column-mapping";
import type { CsvRow, DraftPlace, DraftStatus } from "@/lib/csv/draft-places";

/**
 * The import wizard's state, and nothing that outlives it.
 *
 * Deliberately not in the query cache: none of this exists on the server until
 * the review step is confirmed. Zustand rather than Context because the review
 * step re-renders per row edit and a Context would re-render every row
 * (CLAUDE.md §3).
 */

export type ImportStep = "file" | "mapping" | "geocoding" | "review" | "done";

type ImportState = {
  step: ImportStep;

  fileName: string | null;
  headers: string[];
  rows: CsvRow[];
  /** True when the file was longer than we're willing to read. */
  truncated: boolean;
  skippedBlankRows: number;

  mapping: ColumnMapping;
  drafts: DraftPlace[];

  /** Geocoding progress, in rows. */
  geocodedCount: number;
  geocodeTotal: number;
  /** Set when the run stops early, by cancel or by upstream failure. */
  geocodeError: string | null;

  importedCount: number;

  setStep: (step: ImportStep) => void;
  setFile: (file: {
    fileName: string;
    headers: string[];
    rows: CsvRow[];
    truncated: boolean;
    mapping: ColumnMapping;
  }) => void;
  setMappingField: (field: keyof ColumnMapping, header: string | undefined) => void;
  setDrafts: (drafts: DraftPlace[], skippedBlankRows: number) => void;
  patchDraft: (key: string, patch: Partial<DraftPlace>) => void;
  removeDraft: (key: string) => void;
  startGeocoding: (total: number) => void;
  advanceGeocoding: (by: number) => void;
  failGeocoding: (message: string) => void;
  finishImport: (count: number) => void;
  reset: () => void;
};

const initialState = {
  step: "file" as ImportStep,
  fileName: null,
  headers: [] as string[],
  rows: [] as CsvRow[],
  truncated: false,
  skippedBlankRows: 0,
  mapping: {} as ColumnMapping,
  drafts: [] as DraftPlace[],
  geocodedCount: 0,
  geocodeTotal: 0,
  geocodeError: null,
  importedCount: 0,
};

export const useImportStore = create<ImportState>()((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setFile: ({ fileName, headers, rows, truncated, mapping }) =>
    set({
      ...initialState,
      fileName,
      headers,
      rows,
      truncated,
      mapping,
      step: "mapping",
    }),

  setMappingField: (field, header) =>
    set((state) => {
      const mapping = { ...state.mapping };

      if (header) {
        // A header can only feed one field, so claiming it releases it elsewhere.
        for (const key of Object.keys(mapping) as (keyof ColumnMapping)[]) {
          if (mapping[key] === header) delete mapping[key];
        }
        mapping[field] = header;
      } else {
        delete mapping[field];
      }

      return { mapping };
    }),

  setDrafts: (drafts, skippedBlankRows) => set({ drafts, skippedBlankRows }),

  patchDraft: (key, patch) =>
    set((state) => ({
      drafts: state.drafts.map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    })),

  removeDraft: (key) =>
    set((state) => ({
      drafts: state.drafts.filter((draft) => draft.key !== key),
    })),

  startGeocoding: (geocodeTotal) =>
    set({ step: "geocoding", geocodeTotal, geocodedCount: 0, geocodeError: null }),

  advanceGeocoding: (by) =>
    set((state) => ({ geocodedCount: state.geocodedCount + by })),

  failGeocoding: (geocodeError) => set({ geocodeError }),

  finishImport: (importedCount) => set({ step: "done", importedCount }),

  reset: () => set(initialState),
}));

/** Applies a batch result to a draft. Kept here so the shape lives in one place. */
export function draftFromGeocodeResult(
  draft: DraftPlace,
  result: {
    candidate: { lat: number; lng: number; label: string; confidence: number } | null;
    status: DraftStatus;
  },
): Partial<DraftPlace> {
  if (!result.candidate) {
    return { status: "failed", matchedLabel: null, confidence: null };
  }

  return {
    lat: result.candidate.lat,
    lng: result.candidate.lng,
    matchedLabel: result.candidate.label,
    confidence: result.candidate.confidence,
    status: result.status,
  };
}
