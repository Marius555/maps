"use client";

import { useEffect, useRef, useState } from "react";

import {
  planGeocode,
  summarizeGeocodeScope,
  type GeocodePlan,
  type GeocodeScope,
} from "@/lib/import/geocode-plan";
import { runGeocode } from "@/lib/import/geocode-run";
import { useGeocodeBatch } from "@/lib/query/import";
import { toastProblem } from "@/lib/query/toast-error";
import {
  draftFromGeocodeResult,
  useImportStore,
} from "@/lib/stores/import-store";
import { MAX_GEOCODE_BATCH } from "@/lib/validation/geocode.schema";

/**
 * The first chunk's size. Answers stream in per address, so this matters only
 * where a host buffers the stream and a chunk lands whole — then a small first
 * one still moves the bar within a few seconds.
 */
const FIRST_CHUNK = 5;

/**
 * How long a finished run holds at 100% before Review replaces it. Without it
 * the last address and the page change land in the same frame, and the bar is
 * never seen full.
 */
const FINISHED_HOLD_MS = 600;

/**
 * How long the count may sit still before the screen says so. Comfortably past
 * a full chunk's normal time, well short of the request's own deadline.
 */
export const STALL_AFTER_MS = 20_000;

export type GeocodeRunView = {
  /** What the run will cost, worked out once, before the first request. */
  plan: GeocodePlan | null;
  /** Where the file's other rows went. */
  scope: GeocodeScope | null;
  /** The address being looked up right now, as the user wrote it; null when none is. */
  currentAddress: string | null;
  /** Measured, not guessed: null until the first chunk has landed. */
  remainingMs: number | null;
  /** True once the count has not moved for `STALL_AFTER_MS`. */
  isStalled: boolean;
  /** Ends the run now, even mid-chunk. Rows not yet answered go to Review flagged. */
  skip: () => void;
};

/**
 * Step 3's run: plan it, walk it past the geocoder, and keep the screen told.
 *
 * The retry policy is `lib/import/geocode-run.ts`; this owns the parts that need
 * React — the store writes, the Skip button's abort, the stall clock and the
 * time estimate.
 *
 * The run survives the component: everything it writes goes through the store,
 * which persists to IndexedDB, so a reload mid-run resumes at the first address
 * that never got an answer.
 */
export function useGeocodeRun(mapId: string, onDone: () => void): GeocodeRunView {
  const geocodeBatch = useGeocodeBatch(mapId);

  const [plan, setPlan] = useState<GeocodePlan | null>(null);
  const [scope, setScope] = useState<GeocodeScope | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [isStalled, setIsStalled] = useState(false);

  /**
   * Only Skip sets these — deliberately not the effect's cleanup. StrictMode
   * runs effect → cleanup → effect on one mounted instance, so a cleanup that
   * cancelled would abort the in-flight run and skip the final onDone, leaving
   * the wizard stuck at 100%.
   */
  const skipped = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const hasStarted = useRef(false);
  /** When the count last moved, or a chunk last went out. Read by the stall clock. */
  const lastMovedAt = useRef(0);
  // Kept in a ref so the run doesn't capture a stale closure from first render.
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    // The run outlives StrictMode's second invocation, so it must start once.
    // The wizard keys this step on each entry, so a new entry is a new mount.
    if (hasStarted.current) return;
    hasStarted.current = true;

    const store = useImportStore.getState();
    const current = planGeocode(store.drafts);

    setPlan(current);
    setScope(summarizeGeocodeScope(store.drafts));
    store.startGeocoding(current.rowCount);

    if (current.rowCount === 0) {
      onDoneRef.current();
      return;
    }

    const controller = new AbortController();
    abort.current = controller;

    /*
     * Progress is counted in *rows*, not in lookups.
     *
     * "1,400 of 2,940 addresses" has to mean the user's own rows, or a file with
     * duplicates would show a total that matches nothing they can see. The run
     * reports in lookups, so the rows each one covers are added up here.
     */
    let rowsDone = 0;
    let rowsReported = 0;

    /*
     * The address being asked about now is the first one, in file order, with
     * no answer yet: the server walks a chunk in order, and a retry re-asks only
     * what is left, still in order.
     */
    const answeredLookups = new Set<(typeof current.lookups)[number]>();
    let next = 0;
    const showNext = () => {
      while (next < current.lookups.length && answeredLookups.has(current.lookups[next]!)) {
        next += 1;
      }
      setCurrentAddress(current.lookups[next]?.address ?? null);
    };
    const startedAt = Date.now();
    lastMovedAt.current = startedAt;

    const finish = () => {
      setCurrentAddress(null);
      onDoneRef.current();
    };

    runGeocode({
      lookups: current.lookups,
      batchSize: MAX_GEOCODE_BATCH,
      firstBatchSize: FIRST_CHUNK,

      send: async ({ rows, onResult }) =>
        await geocodeBatch.mutateAsync({
          rows,
          runTotal: current.rowCount,
          signal: controller.signal,
          onResult,
        }),

      onChunkStart: showNext,

      onResult: (lookup, result) => {
        const state = useImportStore.getState();

        for (const key of lookup.keys) {
          const draft = state.drafts.find((candidate) => candidate.key === key);
          if (!draft) continue;

          state.patchDraft(
            key,
            result
              ? draftFromGeocodeResult(draft, result)
              : // The chunk was abandoned. Said as "failed" rather than left
                // pending, because pending means an answer is still coming and
                // for these rows it is not — they belong in the review step
                // flagged, where a person can place them by hand.
                {
                  status: "failed",
                  matchedLabel: null,
                  confidence: null,
                  alternatives: [],
                },
          );
        }

        rowsDone += lookup.keys.length;
        answeredLookups.add(lookup);
        showNext();
      },

      onProgress: (done) => {
        const state = useImportStore.getState();

        const delta = rowsDone - rowsReported;
        rowsReported = rowsDone;
        if (delta > 0) state.advanceGeocoding(delta);

        // So a run's age is measured from the work, not from the moment the
        // file was opened — a forty-minute import must not expire mid-flight.
        state.touch();

        const now = Date.now();
        lastMovedAt.current = now;
        setIsStalled(false);

        // The time left, from the pace this run is actually getting. The
        // server's own spacing was used before, and it left out the round trip
        // and the bookkeeping per lookup — measured at about a third of the
        // real time, which made every estimate three times too hopeful.
        const left = current.lookupCount - done;
        setRemainingMs(left > 0 && done > 0 ? ((now - startedAt) / done) * left : null);
      },

      shouldStop: () => skipped.current,
    })
      .then((summary) => {
        // Keep what resolved and let the user place the rest by hand, rather
        // than losing the whole import. A run that merely skipped a chunk or two
        // reports no error — those rows say so themselves in the review step.
        // Said once, as a toast; the unplaced rows are flagged on Review.
        if (summary.error) {
          useImportStore.getState().failGeocoding(summary.error);
          toastProblem("Address lookup stopped", summary.error);
          finish();
          return;
        }

        // Skipped: the user asked to leave, so leave now.
        if (summary.wasStopped) {
          finish();
          return;
        }

        setCurrentAddress(null);
        setTimeout(finish, FINISHED_HOLD_MS);
      })
      .catch((error: unknown) => {
        /*
         * Anything thrown outside the request itself — a store write, a result
         * the code did not expect. There was no catch here, so one of these
         * left the step at "0 of N" for good with nothing said. Rows not yet
         * answered are still `pending`, which Review flags.
         */
        const message =
          error instanceof Error && error.message
            ? error.message
            : "The address lookup stopped unexpectedly.";

        useImportStore.getState().failGeocoding(message);
        toastProblem("Address lookup stopped", message);
        finish();
      });

    // Runs once per mount; the guard above enforces that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * The stall clock. A slow upstream is told as a sentence rather than left as
   * a bar that has not moved for a minute, which reads as a hang whether it is
   * one or not.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastMovedAt.current === 0) return;
      setIsStalled(Date.now() - lastMovedAt.current > STALL_AFTER_MS);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const skip = () => {
    // Breaks the loop, and aborts the chunk in flight rather than waiting for
    // it — a stalled chunk is exactly when Skip gets pressed. The loop then
    // calls onDone itself, so Review always shows what was resolved.
    skipped.current = true;
    abort.current?.abort();
  };

  return { plan, scope, currentAddress, remainingMs, isStalled, skip };
}
