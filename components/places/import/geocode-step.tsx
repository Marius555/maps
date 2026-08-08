"use client";

import { Button, Label, ProgressBar } from "@heroui/react";
import { useEffect, useRef } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { draftsNeedingGeocode } from "@/lib/csv/draft-places";
import { useGeocodeBatch } from "@/lib/query/import";
import {
  draftFromGeocodeResult,
  useImportStore,
} from "@/lib/stores/import-store";
import { MAX_GEOCODE_BATCH } from "@/lib/validation/geocode.schema";

/**
 * Step 3: turn addresses into coordinates.
 *
 * Chunked and sequential because the provider is paced at about one request a
 * second (see lib/geocoding/throttle.ts). A 500-row file therefore takes minutes,
 * which is why this step is a visible, skippable progress bar rather than a
 * spinner — and why skipping keeps the rows already resolved.
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
    const pending = draftsNeedingGeocode(store.drafts);

    store.startGeocoding(pending.length);

    if (pending.length === 0) {
      onDoneRef.current();
      return;
    }

    const run = async () => {
      for (let start = 0; start < pending.length; start += MAX_GEOCODE_BATCH) {
        if (skipped.current) break;

        const chunk = pending.slice(start, start + MAX_GEOCODE_BATCH);

        try {
          const results = await geocodeBatch.mutateAsync({
            rows: chunk.map((draft) => ({
              key: draft.key,
              address: draft.address,
            })),
          });

          for (const result of results) {
            const draft = chunk.find((candidate) => candidate.key === result.key);
            if (!draft) continue;

            useImportStore
              .getState()
              .patchDraft(result.key, draftFromGeocodeResult(draft, result));
          }

          useImportStore.getState().advanceGeocoding(chunk.length);
        } catch (error) {
          // Stop, keep what resolved, and let the user place the rest by hand
          // rather than losing the whole import.
          useImportStore
            .getState()
            .failGeocoding(
              error instanceof Error
                ? error.message
                : "The address lookup stopped unexpectedly.",
            );
          return;
        }
      }

      onDoneRef.current();
    };

    void run();
    // Runs once per wizard visit; the guard above enforces that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percentage =
    geocodeTotal === 0 ? 100 : Math.round((geocodedCount / geocodeTotal) * 100);

  return (
    <SectionPanel
      title="Looking up addresses"
      description="Addresses are looked up once, now — never when someone views your map."
    >
      <ProgressBar
        aria-label="Address lookup progress"
        className="w-full"
        value={percentage}
      >
        <Label>
          {geocodedCount.toLocaleString()} of {geocodeTotal.toLocaleString()}{" "}
          addresses
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
    </SectionPanel>
  );
}
