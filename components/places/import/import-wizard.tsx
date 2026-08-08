"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LinkButton } from "@/components/ui/link-button";
import { importableDrafts } from "@/lib/csv/draft-places";
import { draftToCreateInput } from "@/lib/csv/draft-to-place";
import {
  normalizeLabel,
  resolveCategories,
} from "@/lib/csv/resolve-categories";
import { useBulkCreatePlaces } from "@/lib/query/import";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { useImportStore } from "@/lib/stores/import-store";
import { MAX_BULK_PLACES } from "@/lib/validation/place.schema";
import { FileStep } from "./file-step";
import { GeocodeStep } from "./geocode-step";
import { ImportSteps } from "./import-steps";
import { MappingStep } from "./mapping-step";
import { ReviewStep } from "./review-step";

/**
 * Owns the flow between steps and performs the confirmed import.
 *
 * Each step is its own component with its own state; this only decides which one
 * is showing and what happens on confirm.
 */
export function ImportWizard({ map }: { map: AppMap }) {
  const router = useRouter();
  const bulkCreate = useBulkCreatePlaces(map.id);
  const updateMap = useUpdateMap(map.id);

  const step = useImportStore((state) => state.step);
  const setStep = useImportStore((state) => state.setStep);
  const importedCount = useImportStore((state) => state.importedCount);
  const finishImport = useImportStore((state) => state.finishImport);
  const reset = useImportStore((state) => state.reset);

  const [addedCategoryCount, setAddedCategoryCount] = useState(0);

  // A stale wizard from a previous visit would otherwise reopen mid-flow.
  useEffect(() => reset, [reset]);

  const runImport = async () => {
    const drafts = importableDrafts(useImportStore.getState().drafts);
    if (drafts.length === 0) return;

    // Categories first: places store a category id, so the ids have to exist
    // before the rows that reference them.
    const resolved = resolveCategories(
      drafts.map((draft) => draft.categoryLabel),
      map.categories,
    );

    if (resolved.added.length > 0) {
      await updateMap.mutateAsync({ categories: resolved.categories });
      setAddedCategoryCount(resolved.added.length);
    }

    let saved = 0;

    // Chunked to stay inside the endpoint's per-request cap. Each chunk
    // re-checks the plan limit server-side, so a limit hit stops the run with
    // the earlier chunks already saved and reported.
    for (let start = 0; start < drafts.length; start += MAX_BULK_PLACES) {
      const chunk = drafts.slice(start, start + MAX_BULK_PLACES);

      const result = await bulkCreate.mutateAsync(
        chunk.map((draft) =>
          draftToCreateInput(
            draft,
            resolved.idByLabel.get(normalizeLabel(draft.categoryLabel)) ?? "",
          ),
        ),
      );

      saved += result.count;
    }

    finishImport(saved);
  };

  return (
    <div className="space-y-6">
      <ImportSteps current={step} />

      {step === "file" ? <FileStep /> : null}

      {step === "mapping" ? (
        <MappingStep onContinue={() => setStep("geocoding")} />
      ) : null}

      {step === "geocoding" ? (
        <GeocodeStep mapId={map.id} onDone={() => setStep("review")} />
      ) : null}

      {step === "review" ? (
        <ReviewStep
          map={map}
          isImporting={bulkCreate.isPending || updateMap.isPending}
          importError={bulkCreate.error ?? updateMap.error}
          onImport={() => void runImport()}
          onBack={() => setStep("mapping")}
        />
      ) : null}

      {step === "done" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Imported {importedCount.toLocaleString()}{" "}
              {importedCount === 1 ? "location" : "locations"}
            </h2>
            <p className="text-xs text-muted">
              {addedCategoryCount > 0
                ? `${addedCategoryCount} new ${addedCategoryCount === 1 ? "category was" : "categories were"} created from your file. `
                : ""}
              They&rsquo;re on your map now.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/maps/${map.id}`}>View the map</LinkButton>
            <LinkButton variant="secondary" href={`/maps/${map.id}/places`}>
              See all locations
            </LinkButton>
            <LinkButton
              variant="tertiary"
              href={`/maps/${map.id}/places/import`}
              onClick={() => {
                reset();
                router.refresh();
              }}
            >
              Import another file
            </LinkButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
