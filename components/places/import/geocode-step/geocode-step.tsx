"use client";

import { Button } from "@heroui/react";

import { useImportStore } from "@/lib/stores/import-store";
import { GeocodeProgress } from "./geocode-progress";
import { GeocodeSummary } from "./geocode-summary";
import { useGeocodeRun } from "./use-geocode-run";

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
 * 1. **What it will cost**, and where the rest of the file went — `GeocodeSummary`.
 * 2. **That it is working.** One bar, whose count moves per address as the
 *    answers stream in, and the address being asked about now — `GeocodeProgress`.
 *    A count that has not moved for twenty seconds is said too, with Skip beside it.
 * 3. **What happens when it goes wrong.** The retry policy is
 *    `lib/import/geocode-run.ts`; the run's React half is `useGeocodeRun`.
 */
export function GeocodeStep({
  mapId,
  onDone,
}: {
  mapId: string;
  onDone: () => void;
}) {
  const geocodedCount = useImportStore((state) => state.geocodedCount);
  const geocodeTotal = useImportStore((state) => state.geocodeTotal);
  const geocodeError = useImportStore((state) => state.geocodeError);

  const { plan, scope, currentAddress, remainingMs, isStalled, skip } =
    useGeocodeRun(mapId, onDone);

  return (
    // No width of its own: the wizard caps this step, and a second cap here
    // would fight it.
    <div className="space-y-6">
      {/* The same weight as the Source step's title, so the wizard does not
          shrink its voice halfway through. */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Looking up addresses
        </h2>
        <p className="text-sm text-muted">
          Each address is looked up once, now — never when someone views your
          map.
        </p>
      </div>

      <GeocodeProgress
        done={geocodedCount}
        total={geocodeTotal}
        currentAddress={geocodeError ? null : currentAddress}
        remainingMs={remainingMs}
        hasError={geocodeError !== null}
      />

      {plan && plan.rowCount > 0 ? (
        <GeocodeSummary plan={plan} scope={scope} />
      ) : null}

      {/* The note on the left, the way on to the right: a stalled run and a
          stopped one each say why beside the one button that answers it. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p role="status" className="min-w-0 flex-1 basis-60 text-xs text-muted">
          {geocodeError
            ? "The addresses already found are kept. Continue to place the rest by hand."
            : isStalled
              ? "The address service is slow to answer. Keep waiting, or skip and place the rest by hand on the next screen."
              : null}
        </p>

        {geocodeError ? (
          <Button variant="primary" onPress={onDone}>
            Continue to review
          </Button>
        ) : (
          <Button variant={isStalled ? "secondary" : "tertiary"} onPress={skip}>
            Skip the rest
          </Button>
        )}
      </div>
    </div>
  );
}
