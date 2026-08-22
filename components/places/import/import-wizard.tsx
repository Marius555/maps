"use client";

import { toast } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { stepMotion } from "@/components/ui/list-row-motion";
import { formatCount } from "@/lib/format/number";
import { importableDrafts } from "@/lib/import/draft-places";
import { draftToCreateInput } from "@/lib/import/draft-to-place";
import { preflightProblem } from "@/lib/import/preflight";
import {
  normalizeLabel,
  resolveCategories,
} from "@/lib/import/resolve-categories";
import { resolveTags } from "@/lib/import/resolve-tags";
import { useBulkCreatePlaces } from "@/lib/query/import";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { useImportStore } from "@/lib/stores/import-store";
import { MAX_BULK_PLACES } from "@/lib/validation/place.schema";
import { GeocodeStep } from "./geocode-step";
import { ImportSteps } from "./import-steps";
import { MappingStep } from "./mapping-step/mapping-step";
import { ReviewStep } from "./review-step/review-step";
import { SourceStep } from "./source-step/source-step";

export type ImportHeadroom = {
  plan: string;
  limit: number;
  used: number;
};

/**
 * Owns the flow between steps and performs the confirmed import.
 *
 * Each step is its own component with its own state; this only decides which one
 * is showing and what happens on confirm.
 *
 * A finished import goes straight to the map. There used to be a fifth screen
 * here — a heading, a sentence and three links — and it was a stop sign in front
 * of the thing the user came to build. What it said that mattered is a count and
 * the odd caveat, which is what a toast is for.
 */
export function ImportWizard({
  map,
  headroom,
}: {
  map: AppMap;
  headroom: ImportHeadroom;
}) {
  const router = useRouter();
  const bulkCreate = useBulkCreatePlaces(map.id);
  const updateMap = useUpdateMap(map.id);

  const step = useImportStore((state) => state.step);
  const setStep = useImportStore((state) => state.setStep);
  const reset = useImportStore((state) => state.reset);

  /**
   * A row that can't be written, caught before the first request goes out.
   *
   * Its own state rather than a thrown error: `runImport` is fired from a press
   * handler, so throwing produced an unhandled rejection and a review step whose
   * only error slot — the mutation's — was still empty.
   */
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // A stale wizard from a previous visit would otherwise reopen mid-flow.
  useEffect(() => reset, [reset]);

  const finish = (saved: number, total: number, addedCategories: number) => {
    const description = describeImport({ saved, total, addedCategories });

    // The action keeps its name the whole way through (CLAUDE.md §8): the button
    // says Import and this says Imported. A run that stopped short says so in a
    // warning rather than claiming a clean finish.
    if (saved < total) {
      toast.warning("Imported some of the file", { description });
    } else {
      toast.success("Imported", { description });
    }

    router.push(`/maps/${map.id}`);
  };

  const runImport = async () => {
    const drafts = importableDrafts(useImportStore.getState().drafts);
    if (drafts.length === 0) return;

    setPreflightError(null);

    const resolved = resolveCategories(
      drafts.map((draft) => draft.categoryLabel),
      map.categories,
    );

    /*
     * The same reconciliation for tags, and it has to happen before the first
     * chunk for the same reason: a place stores ids, and the ids only exist once
     * the labels in the file have been matched to the map's vocabulary or added
     * to it. `flatMap` because a row carries several.
     */
    const tags = resolveTags(
      drafts.flatMap((draft) => draft.tagLabels),
      map.tagGroups,
    );

    // Built up front so every row can be checked before the first request goes
    // out. A failure on chunk two would otherwise leave 200 locations saved and
    // a message that names neither the row nor the reason.
    const inputs = drafts.map((draft) => ({
      rowNumber: draft.rowNumber,
      input: draftToCreateInput(
        draft,
        resolved.idByLabel.get(normalizeLabel(draft.categoryLabel)) ?? "",
        // A label the resolver dropped — because the map is at its ceiling —
        // resolves to nothing and is simply left off the row, which is what the
        // dropped list is reported for.
        draft.tagLabels
          .map((label) => tags.idByLabel.get(normalizeLabel(label)))
          .filter((id): id is string => Boolean(id)),
      ),
    }));

    const problem = preflightProblem(inputs);
    if (problem) {
      setPreflightError(problem);
      return;
    }

    let saved = 0;
    let addedCategories = 0;

    try {
      // Chunked to stay inside the endpoint's per-request cap. Each chunk
      // re-checks the plan limit server-side, so a limit hit stops the run with
      // the earlier chunks already saved.
      for (let start = 0; start < inputs.length; start += MAX_BULK_PLACES) {
        const chunk = inputs.slice(start, start + MAX_BULK_PLACES);

        const result = await bulkCreate.mutateAsync(
          chunk.map((entry) => entry.input),
        );

        saved += result.count;

        // Categories are written once the first chunk has actually landed.
        // Writing them up front — as this used to — left a map full of new
        // categories and no locations whenever the plan limit rejected the very
        // first chunk, and the user had to delete them by hand.
        if (start === 0 && (resolved.added.length > 0 || tags.addedCount > 0)) {
          // One PATCH for both. `updateMap` writes each JSON column it is given
          // and leaves the rest alone, but two calls would be two round trips
          // and two chances to half-apply the vocabulary this import needs.
          await updateMap.mutateAsync({
            ...(resolved.added.length > 0 ? { categories: resolved.categories } : {}),
            ...(tags.addedCount > 0 ? { tagGroups: tags.tagGroups } : {}),
          });
          addedCategories = resolved.added.length;
        }
      }
    } catch {
      // Whatever landed before the failure is real and already on the map. Going
      // quiet about it would leave the user thinking nothing was imported and
      // re-running the whole file on top of itself. With nothing saved there is
      // nowhere to send them, and the mutation's own error is already on screen.
      if (saved > 0) finish(saved, drafts.length, addedCategories);
      return;
    }

    finish(saved, drafts.length, addedCategories);
  };

  /**
   * Which steps need the page rather than a column.
   *
   * The page itself is `Container size="content"` and the cap lives here, because
   * the two answers are genuinely different per step and only this component
   * knows which step is showing. Columns and Review are both trying to show you
   * the file: one is a table wider than any laptop, the other is a map where a
   * pin two streets out is invisible at 400px. Source and Addresses are a
   * dropzone and a progress bar, and stretching either across a 2560px monitor
   * would make them harder to use, not easier.
   */
  const isWide = step === "mapping" || step === "review";

  return (
    /*
     * `max-w-full`, not `max-w-none`: `none` is not a length and does not
     * interpolate, so the transition would not play in one direction. 64rem to
     * 100% does. There is no `motion-reduce:` here because there does not need
     * to be — the blanket `prefers-reduced-motion` rule in globals.css already
     * clamps every transition in the app to 0.01ms.
     */
    <div
      className={`mx-auto w-full transition-[max-width] duration-[var(--duration-panel)] ease-[var(--ease-out)] ${
        isWide ? "max-w-full" : "max-w-5xl"
      }`}
    >
      <div className="relative space-y-6">
        <ImportSteps current={step} />

        {/*
         * `popLayout`, and the mode matters more than it looks.
         *
         * The obvious choice is `wait` — hold the outgoing panel until it has
         * left, then bring the next one in — because these four panels differ by
         * hundreds of pixels in height and the default mode would put two of them
         * in flow at once, growing the page to the sum and then shutting it.
         *
         * But `wait` does not delay a paint, it delays a *mount*, and one of
         * these steps does its work on mount: `GeocodeStep` starts the address
         * lookup from a `useEffect`. So an exit that has not finished is an
         * import that has not started — and an exit does not finish while the tab
         * is in the background, because the browser stops servicing animations
         * there. Someone who presses Continue on a 500-row file and switches away
         * to wait it out would come back to a wizard that had not begun.
         *
         * `popLayout` takes the leaving panel out of flow instead, so the next
         * one mounts in the same commit and the two cross-fade rather than
         * stacking. `relative` on the wrapper below is what the absolute
         * positioning is measured against.
         */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={step} {...stepMotion()}>
            {step === "source" ? (
              <SourceStep mapId={map.id} headroom={headroom} />
            ) : null}

            {step === "mapping" ? (
              <MappingStep onContinue={() => setStep("geocoding")} />
            ) : null}

            {step === "geocoding" ? (
              <GeocodeStep mapId={map.id} onDone={() => setStep("review")} />
            ) : null}

            {step === "review" ? (
              <ReviewStep
                map={map}
                headroom={headroom}
                isImporting={bulkCreate.isPending || updateMap.isPending}
                importError={preflightError ?? bulkCreate.error ?? updateMap.error}
                onImport={() => void runImport()}
                onBack={() => setStep("mapping")}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function describeImport({
  saved,
  total,
  addedCategories,
}: {
  saved: number;
  total: number;
  addedCategories: number;
}): string {
  const parts = [
    saved < total
      ? `${formatCount(saved)} of ${formatCount(total)} locations were saved before this stopped.`
      : `${formatCount(saved)} ${saved === 1 ? "location is" : "locations are"} on your map.`,
  ];

  if (addedCategories > 0) {
    parts.push(
      `${formatCount(addedCategories)} new ${
        addedCategories === 1 ? "category" : "categories"
      } came from your file.`,
    );
  }

  return parts.join(" ");
}
