"use client";

import { Button, Label, ProgressBar } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { formatCount, formatRoughDuration } from "@/lib/format/number";
import {
  estimateGeocodeMs,
  planGeocode,
  type GeocodePlan,
} from "@/lib/import/geocode-plan";
import { runGeocode } from "@/lib/import/geocode-run";
import { useGeocodeBatch } from "@/lib/query/import";
import {
  draftFromGeocodeResult,
  useImportStore,
} from "@/lib/stores/import-store";
import { MAX_GEOCODE_BATCH } from "@/lib/validation/geocode.schema";

/**
 * Step 3: turn addresses into coordinates.
 *
 * Chunked and sequential because the provider paces itself, so a large file
 * takes minutes — which is why this step is a visible, skippable progress bar
 * with a stated duration rather than a spinner, and why skipping keeps the rows
 * already resolved.
 *
 * The three things this screen has to be honest about, in order:
 *
 * 1. **What it will cost.** `planGeocode` folds rows sharing an address into one
 *    lookup, so a file with repeats spends fewer requests than it has rows, and
 *    both numbers are said out loud before anything starts.
 * 2. **How long that is.** `paceMs` comes back from the endpoint with the first
 *    chunk, so the estimate is the pacing we are actually holding rather than a
 *    guess baked into the client.
 * 3. **What happens when it goes wrong.** Nothing about the retry policy lives
 *    here — it is `lib/import/geocode-run.ts`, which is where it can be tested.
 *    This component owns the bar and the buttons.
 *
 * The run itself survives this component: everything it writes goes through the
 * store, which persists to IndexedDB, so a reload mid-run resumes at the first
 * address that never got an answer.
 */
export function GeocodeStep({
  mapId,
  onDone,
}: {
  mapId: string;
  onDone: () => void;
}) {
  const geocodeBatch = useGeocodeBatch(mapId);

  const geocodedCount = useImportStore((state) => state.geocodedCount);
  const geocodeTotal = useImportStore((state) => state.geocodeTotal);
  const geocodeError = useImportStore((state) => state.geocodeError);

  /** What the run will cost, worked out once, before the first request. */
  const [plan, setPlan] = useState<GeocodePlan | null>(null);

  /**
   * The server's own spacing, once a chunk has come back and said so. Null until
   * then, which is why the estimate appears a moment after the bar does rather
   * than being invented up front.
   */
  const [paceMs, setPaceMs] = useState<number | null>(null);

  /**
   * Only the Skip button sets this — deliberately not the effect's cleanup.
   * StrictMode runs effect → cleanup → effect on one mounted instance, so a
   * cleanup that cancelled would abort the in-flight run and, worse, skip the
   * final onDone: the loop would finish its one chunk and then find itself
   * "cancelled", leaving the wizard stuck at 100%.
   */
  const skipped = useRef(false);
  const hasStarted = useRef(false);
  // Kept in a ref so the run doesn't capture a stale closure from first render.
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    // The run outlives StrictMode's second invocation, so it must start once.
    if (hasStarted.current) return;
    hasStarted.current = true;

    const store = useImportStore.getState();
    const current = planGeocode(store.drafts);

    setPlan(current);
    store.startGeocoding(current.rowCount);

    if (current.rowCount === 0) {
      onDoneRef.current();
      return;
    }

    /*
     * Progress is counted in *rows*, not in lookups.
     *
     * "1,400 of 2,940 addresses" has to mean the user's own rows, or a file with
     * duplicates would show a total that matches nothing they can see. The run
     * reports in lookups, so the rows each one covers are added up here.
     */
    let rowsDone = 0;
    let rowsReported = 0;

    void runGeocode({
      lookups: current.lookups,
      batchSize: MAX_GEOCODE_BATCH,

      send: async ({ rows }) =>
        await geocodeBatch.mutateAsync({ rows, runTotal: current.rowCount }),

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
      },

      onProgress: (_done, pace) => {
        const state = useImportStore.getState();

        const delta = rowsDone - rowsReported;
        rowsReported = rowsDone;
        if (delta > 0) state.advanceGeocoding(delta);

        // So a run's age is measured from the work, not from the moment the
        // file was opened — a forty-minute import must not expire mid-flight.
        state.touch();

        if (pace !== undefined) setPaceMs(pace);
      },

      shouldStop: () => skipped.current,
    }).then((summary) => {
      // Keep what resolved and let the user place the rest by hand, rather than
      // losing the whole import. A run that merely skipped a chunk or two
      // reports no error — those rows say so themselves in the review step.
      if (summary.error) useImportStore.getState().failGeocoding(summary.error);

      onDoneRef.current();
    });

    // Runs once per wizard visit; the guard above enforces that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percentage =
    geocodeTotal === 0 ? 100 : Math.round((geocodedCount / geocodeTotal) * 100);

  const remaining = plan
    ? Math.max(plan.lookupCount - Math.round((geocodedCount / Math.max(plan.rowCount, 1)) * plan.lookupCount), 0)
    : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Looking up addresses
        </h2>
        <p className="text-xs text-muted">
          Addresses are looked up once, now — never when someone views your map.
        </p>
      </div>

      {/*
       * The cost, before the wait rather than after it.
       *
       * A progress bar with no number beside it is indistinguishable from a hang
       * at the four-minute mark, and the one thing that makes the wait
       * acceptable is knowing how long it is. The duplicate count is here for a
       * second reason: it is the only place the user ever learns that their file
       * repeats an address, which is worth knowing about their own data.
       */}
      {plan && plan.rowCount > 0 ? (
        <p className="text-xs text-muted">
          {formatCount(plan.rowCount)}{" "}
          {plan.rowCount === 1 ? "row needs" : "rows need"} an address.
          {plan.savedCount > 0
            ? ` ${formatCount(plan.lookupCount)} lookups after duplicates.`
            : ""}
          {paceMs !== null && remaining > 0
            ? ` About ${formatRoughDuration(
                estimateGeocodeMs({
                  lookupCount: remaining,
                  paceMs,
                  batchSize: MAX_GEOCODE_BATCH,
                }),
              )} left.`
            : ""}
        </p>
      ) : null}

      <ProgressBar
        aria-label="Address lookup progress"
        className="w-full"
        value={percentage}
      >
        <Label>
          {formatCount(geocodedCount)} of {formatCount(geocodeTotal)} addresses
        </Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      {geocodeError ? (
        <div className="space-y-3">
          <ErrorMessage error={geocodeError} />
          <p className="text-xs text-muted">
            The addresses already found are kept. Continue to place the rest by
            hand.
          </p>
          <Button variant="secondary" onPress={() => onDoneRef.current()}>
            Continue to review
          </Button>
        </div>
      ) : (
        <Button
          variant="tertiary"
          onPress={() => {
            // Breaks the loop after the in-flight chunk; the loop then calls
            // onDone itself, so review always shows what was resolved.
            skipped.current = true;
          }}
        >
          Skip the rest
        </Button>
      )}
    </div>
  );
}
