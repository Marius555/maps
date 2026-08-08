"use client";

import { Button } from "@heroui/react";
import { useMemo, useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import {
  draftsNeedingReview,
  importableDrafts,
  type DraftPlace,
} from "@/lib/csv/draft-places";
import { draftToPlace } from "@/lib/csv/draft-to-place";
import { roundCoord } from "@/lib/map/geo";
import type { AppMap } from "@/lib/repositories/types";
import { useImportStore } from "@/lib/stores/import-store";
import { ReviewRow } from "./review-row";

/** Built per branch rather than by patching plurals into one sentence. */
function reviewSentence(count: number): string {
  if (count === 0) return "Everything found a good match.";

  if (count === 1) {
    return "1 needs a look — drag its pin, or fix it below.";
  }

  return `${count.toLocaleString()} need a look — drag their pins, or fix them below.`;
}

/**
 * Step 4: check the results before anything is written.
 *
 * This step is the whole reason geocoding doesn't save directly (CLAUDE.md §7).
 * Every pin is draggable, rows that need attention are listed first, and nothing
 * reaches the database until Import is pressed.
 */
export function ReviewStep({
  map,
  isImporting,
  importError,
  onImport,
  onBack,
}: {
  map: AppMap;
  isImporting: boolean;
  importError: unknown;
  onImport: () => void;
  onBack: () => void;
}) {
  const drafts = useImportStore((state) => state.drafts);
  const skippedBlankRows = useImportStore((state) => state.skippedBlankRows);
  const patchDraft = useImportStore((state) => state.patchDraft);
  const removeDraft = useImportStore((state) => state.removeDraft);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showOnlyProblems, setShowOnlyProblems] = useState(true);

  const needsReview = useMemo(() => draftsNeedingReview(drafts), [drafts]);
  const importable = useMemo(() => importableDrafts(drafts), [drafts]);

  // Only placed drafts can be drawn. The rest are fixed from the list.
  const placedPlaces = useMemo(
    () =>
      drafts
        .filter((draft) => draft.lat !== null && draft.lng !== null)
        .map((draft) => draftToPlace(draft, map.id)),
    [drafts, map.id],
  );

  const listed = showOnlyProblems && needsReview.length > 0 ? needsReview : drafts;

  const centre = placedPlaces[0] ?? {
    lat: map.defaultLat,
    lng: map.defaultLng,
  };

  const description =
    `${importable.length.toLocaleString()} of ${drafts.length.toLocaleString()} rows are ready. ` +
    reviewSentence(needsReview.length) +
    (skippedBlankRows > 0
      ? ` ${skippedBlankRows} blank row${skippedBlankRows === 1 ? "" : "s"} skipped.`
      : "");

  return (
    <SectionPanel
      title="Check before importing"
      description={description}
      footer={
        <>
          <Button variant="tertiary" onPress={onBack}>
            Back to columns
          </Button>
          <Button
            isPending={isImporting}
            isDisabled={importable.length === 0}
            onPress={onImport}
          >
            Import {importable.length.toLocaleString()}{" "}
            {importable.length === 1 ? "location" : "locations"}
          </Button>
        </>
      }
    >
      <div className="h-64 overflow-hidden rounded-xl border border-border sm:h-80">
        <MapCanvas
          center={{ lng: centre.lng, lat: centre.lat }}
          zoom={map.defaultZoom}
          style={map.style}
          places={placedPlaces}
          selectedPlaceId={selectedKey}
          isAdding={false}
          fitToPlaces
          onSelectPlace={setSelectedKey}
          onMapClick={() => {}}
          onMovePlace={(key, coords) => {
            // A dragged pin was positioned deliberately, so it stops being a
            // geocoder guess and stops being flagged.
            patchDraft(key, {
              lat: roundCoord(coords.lat),
              lng: roundCoord(coords.lng),
              status: "manual",
              problem: null,
            });
          }}
        />
      </div>

      {needsReview.length > 0 ? (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={showOnlyProblems}
            onChange={(event) => setShowOnlyProblems(event.target.checked)}
          />
          Show only rows that need attention
        </label>
      ) : null}

      <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {listed.map((draft: DraftPlace) => (
          <ReviewRow
            key={draft.key}
            draft={draft}
            isSelected={draft.key === selectedKey}
            onSelect={() => setSelectedKey(draft.key)}
            onChange={(patch) => patchDraft(draft.key, patch)}
            onRemove={() => removeDraft(draft.key)}
          />
        ))}
      </ul>

      {importError ? <ErrorMessage error={importError} /> : null}
    </SectionPanel>
  );
}
