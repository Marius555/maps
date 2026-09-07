import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ColumnMapping,
  DetectionResult,
  HeaderSuggestion,
} from "@/lib/import/column-mapping";
import { recomputeIssues } from "@/lib/import/draft-places";
import type {
  BuildDraftsResult,
  CsvRow,
  DraftPlace,
  DraftStatus,
} from "@/lib/import/draft-places";
import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { IMPORT_FIELDS, type ImportField } from "@/lib/import/fields";
import type { LoadedSource } from "@/lib/import/read-source";
import { splitLatLngColumn } from "@/lib/import/split-latlng";
import type { SourceKind } from "@/lib/import/sources/types";
import { createImportStorage, RUN_MAX_AGE_MS } from "./import-persist";

/**
 * The import wizard's state.
 *
 * Deliberately not in the query cache: none of this exists on the server until
 * the review step is confirmed. Zustand rather than Context because the review
 * step re-renders per row edit and a Context would re-render every row
 * (CLAUDE.md §3).
 *
 * **It outlives the page now, and that is the point.** Geocoding a real file is
 * minutes of a metered upstream, and every one of those minutes used to be
 * thrown away by a reload — the wizard held all of this in memory and reset on
 * unmount. It is persisted to IndexedDB instead (`import-persist.ts`), so the
 * run survives a refresh, a crash and a closed tab, and resuming costs nothing:
 * `draftsNeedingGeocode` only ever returns rows still `pending`, so a restored
 * run picks up at the first address that never got an answer.
 *
 * Two fields exist purely to decide whether a restored run is *this* run.
 * `mapId` is which map it belongs to — one persisted key serves every map, and
 * a run restored onto the wrong map would import one customer's file into
 * another's map. `savedAt` is when it was last touched, so a run nobody came
 * back to is discarded rather than offered a week later. `attachTo` is where
 * both are checked; the wizard calls it on mount.
 *
 * `loaded` is deliberately **not** persisted. It is the raw grid the file was
 * read from, kept only so the header row can be picked again, and it roughly
 * doubles what has to be cloned on every write. Re-picking a header row happens
 * in the first seconds of a flow; resuming happens ten minutes in. The mapping
 * step already renders that control only when `loaded` is there, so a restored
 * run simply does not offer it.
 */

export type ImportStep = "source" | "mapping" | "geocoding" | "review";

type ImportState = {
  step: ImportStep;

  /**
   * Which map this run belongs to, and when it was last written. Both null until
   * a file is chosen. See the note above: they are what make a restored run
   * safe to offer.
   */
  mapId: string | null;
  savedAt: number | null;
  /**
   * True while the wizard is showing a run it picked up from a previous visit.
   *
   * In the store rather than in the component because `attachTo` is what decides
   * it, and a component that had to call `setState` from an effect to mirror
   * that decision is the cascading render the React Compiler lint rule is about.
   * Deliberately not persisted: it describes this visit, not the run.
   */
  isResumed: boolean;

  sourceKind: SourceKind | null;
  fileName: string | null;
  headers: string[];
  rows: CsvRow[];
  /** True when the source was longer than we're willing to read. */
  truncated: boolean;
  /** True when we named the columns ourselves because the file had no header row. */
  headersAreSynthetic: boolean;
  /** Rows above the header we skipped — a title banner, usually. */
  skippedLeadingRows: number;
  /** Rows inside the data that repeated the header, and were dropped. */
  repeatedHeaderRows: number;
  /**
   * The source as it was read, and which row we took as the column names.
   *
   * Kept so the header row can be chosen again — detection is a heuristic, and
   * without this a wrong guess makes the file unimportable with no way back.
   */
  loaded: LoadedSource | null;
  headerRowIndex: number | null;
  skippedBlankRows: number;
  /** Website/email values cleared because they couldn't be made valid. */
  droppedContacts: number;

  mapping: ColumnMapping;
  /** What detection thought, and how sure it was. Drives the confidence marks. */
  detection: DetectionResult["detail"];
  /**
   * Per column, the fields it could hold, best first. Ranks the picker's menu.
   *
   * Deliberately *not* cleared when the user answers a column, which is the one
   * way this differs from `detection`. That is cleared on every edit because it
   * is our claim about what a column is, and once the user has spoken it would
   * be crediting us for their answer. This is not a claim about anything — it is
   * a reading of the file — and clearing it would empty the ranked section of
   * the menu at the exact moment someone is working through the columns fixing
   * them, which is the only moment it is any use.
   */
  suggestions: Record<string, HeaderSuggestion[]>;
  /**
   * What the last coordinate split produced, so the table can say so.
   *
   * Structured rather than a sentence: the copy belongs beside the table that
   * shows the two new columns, not in the store.
   */
  splitNotice: SplitNotice | null;
  drafts: DraftPlace[];

  /** Geocoding progress, in rows. */
  geocodedCount: number;
  geocodeTotal: number;
  /** Set when the run stops early, by cancel or by upstream failure. */
  geocodeError: string | null;

  setStep: (step: ImportStep) => void;
  /**
   * Claim the restored run for this map, or throw it away.
   *
   * Called once on mount, after the persisted run has finished loading. Sets
   * `isResumed` rather than returning it, so the wizard reads the answer with a
   * selector instead of mirroring it into component state from an effect.
   */
  attachTo: (mapId: string) => void;
  setSource: (source: LoadedSource) => void;
  setColumnField: (header: string, field: ImportField | undefined) => void;
  setCell: (rowIndex: number, header: string, value: string) => void;
  splitLatLng: (header: string) => void;
  swapLatLng: () => void;
  setDrafts: (result: BuildDraftsResult) => void;
  patchDraft: (key: string, patch: Partial<DraftPlace>) => void;
  removeDraft: (key: string) => void;
  /**
   * Drop a whole chunk of drafts at once.
   *
   * The commit writes 200 rows per request and has to forget each batch the
   * moment it lands, so that a run resumed after a partial failure imports the
   * remainder rather than the file. Two hundred separate `removeDraft` calls
   * would each map over the whole array — quadratic on a three-thousand-row
   * import, and two hundred renders of the list besides.
   */
  removeDrafts: (keys: string[]) => void;
  startGeocoding: (total: number) => void;
  advanceGeocoding: (by: number) => void;
  failGeocoding: (message: string) => void;
  reset: () => void;
  /**
   * Mark the run as touched, so its age is measured from real activity rather
   * than from the moment the file was opened. Called by the geocode loop, which
   * is the only thing that runs long enough for the difference to matter.
   */
  touch: () => void;
};

export type SplitNotice = {
  latHeader: string;
  lngHeader: string;
  /** Rows that held something unreadable. Blank cells are not counted. */
  unparsed: number;
};

const initialState = {
  step: "source" as ImportStep,
  mapId: null as string | null,
  savedAt: null as number | null,
  isResumed: false,
  sourceKind: null,
  fileName: null,
  headers: [] as string[],
  rows: [] as CsvRow[],
  truncated: false,
  headersAreSynthetic: false,
  skippedLeadingRows: 0,
  repeatedHeaderRows: 0,
  loaded: null as LoadedSource | null,
  headerRowIndex: null as number | null,
  skippedBlankRows: 0,
  droppedContacts: 0,
  mapping: {} as ColumnMapping,
  detection: {} as DetectionResult["detail"],
  suggestions: {} as Record<string, HeaderSuggestion[]>,
  splitNotice: null as SplitNotice | null,
  drafts: [] as DraftPlace[],
  geocodedCount: 0,
  geocodeTotal: 0,
  geocodeError: null,
};

export const useImportStore = create<ImportState>()(
  persist(
    (set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  /**
   * Decide whether what was restored from disk belongs to this page.
   *
   * Three ways a restored run is not ours, and all three end the same way: a
   * run from another map, a run older than a day, and a run that never got past
   * the file picker (nothing to resume, so nothing to say). Anything else is
   * kept and reported, and the wizard shows the way out.
   */
  attachTo: (mapId) => {
    const state = get();
    const isOurs = state.mapId === mapId;
    const isFresh =
      state.savedAt !== null && Date.now() - state.savedAt < RUN_MAX_AGE_MS;

    if (!isOurs || !isFresh) {
      set({ ...initialState, mapId });
      return;
    }

    set({ isResumed: state.step !== "source" });
  },

  setSource: (source) =>
    set((state) => ({
      ...initialState,
      // Kept across the reset: `setSource` is how a *new* file replaces an old
      // one, and the run it starts belongs to the same map the last one did.
      mapId: state.mapId,
      savedAt: Date.now(),
      sourceKind: source.kind,
      fileName: source.label,
      headers: source.headers,
      rows: source.rows,
      truncated: source.truncated,
      headersAreSynthetic: source.headersAreSynthetic,
      skippedLeadingRows: source.skippedLeadingRows,
      repeatedHeaderRows: source.repeatedHeaderRows,
      loaded: source,
      headerRowIndex: source.headerRowIndex,
      mapping: source.detection.mapping,
      detection: source.detection.detail,
      suggestions: source.detection.byHeader,
      step: "mapping",
    })),

  /**
   * What one column of the file is.
   *
   * Phrased column-first rather than field-first because that is the question
   * the mapping step now asks: the user reads down their own spreadsheet and
   * names each column, instead of working through a list of our field names
   * hunting for the column that fits.
   *
   * Both directions of the one-to-one still have to be enforced. Naming a column
   * releases whatever it used to be, and claiming a field releases whatever
   * column used to feed it — otherwise picking "Name" on a second column would
   * leave two columns both showing "Name" and only one of them true.
   */
  setColumnField: (header, field) =>
    set((state) => {
      const mapping = { ...state.mapping };
      const detection = { ...state.detection };

      const previous = fieldOf(mapping, header);
      if (previous) {
        delete mapping[previous];
        delete detection[previous];
      }

      if (field) {
        delete mapping[field];
        mapping[field] = header;

        // The user has answered, so our guess is no longer what's on screen —
        // leaving the badge up would credit us for their choice.
        delete detection[field];
      }

      return { mapping, detection };
    }),

  /**
   * One cell of the source table.
   *
   * The only thing that writes `rows` after the file is read, and deliberately
   * the only one: `buildDraftPlaces(rows, mapping)` runs on Continue, so an edit
   * here is simply part of the file by the time anything downstream sees it.
   *
   * Detection is not re-run. Once the user is typing, our guess is no longer
   * what's on screen, and re-scoring a column under them as they fix its values
   * would move the field they had just chosen.
   */
  setCell: (rowIndex, header, value) =>
    set((state) => ({
      rows: state.rows.map((row, index) =>
        index === rowIndex ? { ...row, [header]: value } : row,
      ),
    })),

  /**
   * One combined coordinate column becomes a Latitude and a Longitude column.
   *
   * The import already reads a combined column correctly, so this buys nothing
   * mechanically — it buys legibility. Two columns of plain numbers can be
   * scanned and corrected cell by cell; "52.5200, 13.4050" can only be trusted.
   */
  splitLatLng: (header) =>
    set((state) => {
      const result = splitLatLngColumn(state.headers, state.rows, header);
      if (!result) return {};

      const mapping = { ...state.mapping };
      const detection = { ...state.detection };

      const previous = fieldOf(mapping, header);
      if (previous) delete mapping[previous];

      // Both halves are now the user's doing, however they were detected.
      delete detection.latlng;
      delete detection.lat;
      delete detection.lng;

      mapping.lat = result.latHeader;
      mapping.lng = result.lngHeader;

      return {
        headers: result.headers,
        rows: result.rows,
        mapping,
        detection,
        splitNotice: {
          latHeader: result.latHeader,
          lngHeader: result.lngHeader,
          unparsed: result.unparsed,
        },
      };
    }),

  /**
   * Exchange the two coordinate columns.
   *
   * Offered when the values say the columns are the wrong way round, which is a
   * mistake that is otherwise invisible until every pin lands in the sea.
   */
  swapLatLng: () =>
    set((state) => {
      const { lat, lng } = state.mapping;
      if (!lat || !lng) return {};

      const detection = { ...state.detection };
      delete detection.lat;
      delete detection.lng;

      return { mapping: { ...state.mapping, lat: lng, lng: lat }, detection };
    }),

  setDrafts: ({ drafts, skippedBlankRows, droppedContacts }) =>
    set({ drafts, skippedBlankRows, droppedContacts }),

  /**
   * The only way a draft changes, and the only place issues are recomputed.
   *
   * Every edit path — the name field, the address field, typed coordinates, a
   * dragged pin, a picked alternative, a geocode result — lands here, so none of
   * them can leave a row's issues disagreeing with its contents. The drag handler
   * used to write `problem: null` directly and that is exactly the bug this
   * shape removes.
   */
  patchDraft: (key, patch) =>
    set((state) => ({
      drafts: state.drafts.map((draft) => {
        if (draft.key !== key) return draft;

        const next = { ...draft, ...patch };
        return { ...next, issues: recomputeIssues(next) };
      }),
    })),

  removeDraft: (key) =>
    set((state) => ({
      drafts: state.drafts.filter((draft) => draft.key !== key),
    })),

  removeDrafts: (keys) =>
    set((state) => {
      const gone = new Set(keys);

      return { drafts: state.drafts.filter((draft) => !gone.has(draft.key)) };
    }),

  startGeocoding: (geocodeTotal) =>
    set({ step: "geocoding", geocodeTotal, geocodedCount: 0, geocodeError: null }),

  advanceGeocoding: (by) =>
    set((state) => ({ geocodedCount: state.geocodedCount + by })),

  failGeocoding: (geocodeError) => set({ geocodeError }),

  /**
   * Throw the run away. Keeps `mapId`, so the next file started on this page is
   * still recognised as belonging to this map.
   */
  reset: () => set((state) => ({ ...initialState, mapId: state.mapId })),

  /** Stamp the run as touched now. Called by the writes that are worth resuming. */
  touch: () => set({ savedAt: Date.now() }),
    }),
    {
      name: "import-run",
      storage: createImportStorage<PersistedImport>(),

      /*
       * What is worth carrying across a reload.
       *
       * `loaded` is the deliberate omission — see the note at the top of the
       * file. `suggestions` and `detection` are in because the mapping step is
       * unusable without them: the picker ranks itself from `suggestions`, and
       * losing it would empty the ranked half of every menu on exactly the file
       * whose column names were useless enough to need it.
       *
       * The actions are not listed and must not be: they are rebuilt by
       * `create` on every load, and a persisted copy of a closure is both
       * meaningless and a merge hazard.
       */
      partialize: (state) => ({
        step: state.step,
        mapId: state.mapId,
        savedAt: state.savedAt,
        sourceKind: state.sourceKind,
        fileName: state.fileName,
        headers: state.headers,
        rows: state.rows,
        truncated: state.truncated,
        headersAreSynthetic: state.headersAreSynthetic,
        skippedLeadingRows: state.skippedLeadingRows,
        repeatedHeaderRows: state.repeatedHeaderRows,
        headerRowIndex: state.headerRowIndex,
        skippedBlankRows: state.skippedBlankRows,
        droppedContacts: state.droppedContacts,
        mapping: state.mapping,
        detection: state.detection,
        suggestions: state.suggestions,
        splitNotice: state.splitNotice,
        drafts: state.drafts,
        geocodedCount: state.geocodedCount,
        geocodeTotal: state.geocodeTotal,
        geocodeError: state.geocodeError,
      }),
    },
  ),
);

type PersistedImport = Omit<
  ImportState,
  | "loaded"
  // Describes this visit rather than the run — see the field's own note.
  | "isResumed"
  | "setStep"
  | "attachTo"
  | "setSource"
  | "setColumnField"
  | "setCell"
  | "splitLatLng"
  | "swapLatLng"
  | "setDrafts"
  | "patchDraft"
  | "removeDraft"
  | "removeDrafts"
  | "startGeocoding"
  | "advanceGeocoding"
  | "failGeocoding"
  | "reset"
  | "touch"
>;

/**
 * Which field a column currently feeds, if any.
 *
 * `ColumnMapping` is keyed the other way round — field to header — because that
 * is what every consumer downstream wants. The mapping step is the one place
 * that needs the reverse, and it needs it per column on every render, so it is
 * one exported helper rather than a second copy of the mapping kept in sync.
 */
export function fieldOf(
  mapping: ColumnMapping,
  header: string,
): ImportField | undefined {
  return IMPORT_FIELDS.find((field) => mapping[field] === header);
}

/**
 * Applies a batch result to a draft. Kept here so the shape lives in one place.
 *
 * `alternatives` are carried across rather than dropped. The endpoint asks for
 * five candidates and has always sent back the four it didn't pick; keeping them
 * is what turns "rough match" from a pin to drag across a country into a list to
 * choose from. Issues are not set here — `patchDraft` derives them.
 */
export function draftFromGeocodeResult(
  draft: DraftPlace,
  result: {
    candidate: { lat: number; lng: number; label: string; confidence: number } | null;
    alternatives?: GeocodeCandidate[];
    status: DraftStatus;
  },
): Partial<DraftPlace> {
  const alternatives = result.alternatives ?? [];

  if (!result.candidate) {
    return { status: "failed", matchedLabel: null, confidence: null, alternatives };
  }

  return {
    lat: result.candidate.lat,
    lng: result.candidate.lng,
    matchedLabel: result.candidate.label,
    confidence: result.candidate.confidence,
    status: result.status,
    alternatives,
  };
}
