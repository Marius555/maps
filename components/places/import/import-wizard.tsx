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
  MAIN_TAG_GROUP_LABEL,
  normalizeLabel,
  resolveTags,
} from "@/lib/import/resolve-tags";
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

  const finish = (saved: number, total: number, addedTags: number) => {
    const description = describeImport({ saved, total, addedTags });

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

    /*
     * The file's labels, reconciled against the map's vocabulary before the
     * first chunk goes out: a place stores tag ids, and the ids only exist once
     * every label has been matched to an existing tag or minted as a new one.
     *
     * Two passes, and the second is fed the first's output rather than the map's
     * own groups — they each add to the same vocabulary, and running both
     * against `map.tagGroups` would let the second overrun a ceiling the first
     * had already spent, or mint a second group with the same name.
     *
     * The main-tag column goes into a group of its own (`MAIN_TAG_GROUP_LABEL`).
     * It is the column that used to be Category: one value per row, nearly
     * always what kind of place it is, and a different question from what the
     * place offers. `flatMap` on the second because a tags column carries
     * several per row.
     */
    const mainTags = resolveTags(
      drafts.map((draft) => draft.categoryLabel),
      map.tagGroups,
      MAIN_TAG_GROUP_LABEL,
    );

    const tags = resolveTags(
      drafts.flatMap((draft) => draft.tagLabels),
      mainTags.tagGroups,
    );

    // Built up front so every row can be checked before the first request goes
    // out. A failure on chunk two would otherwise leave 200 locations saved and
    // a message that names neither the row nor the reason.
    const inputs = drafts.map((draft) => ({
      rowNumber: draft.rowNumber,
      input: draftToCreateInput(
        draft,
        /*
         * The main tag first, because the first tag a location wears is what
         * colours its pin — which is exactly what the Category column did.
         *
         * A label the resolver dropped — because the map is at a ceiling —
         * resolves to nothing and is simply left off the row, which is what the
         * dropped list is reported for. `Set` because a file may name the same
         * label in both columns, and a place wearing one tag twice is one chip.
         */
        [
          ...new Set(
            [
              mainTags.idByLabel.get(normalizeLabel(draft.categoryLabel)),
              ...draft.tagLabels.map((label) =>
                tags.idByLabel.get(normalizeLabel(label)),
              ),
            ].filter((id): id is string => Boolean(id)),
          ),
        ],
      ),
    }));

    const problem = preflightProblem(inputs);
    if (problem) {
      setPreflightError(problem);
      return;
    }

    let saved = 0;
    let addedTags = 0;

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

        // The vocabulary is written once the first chunk has actually landed.
        // Writing it up front — as this used to — left a map full of new tags
        // and no locations whenever the plan limit rejected the very first
        // chunk, and the user had to delete them by hand.
        //
        // `tags.tagGroups` already contains everything `mainTags` added: the
        // second pass was fed the first's output, which is what makes one PATCH
        // enough and what stops the two halves being half-applied.
        const added = mainTags.addedCount + tags.addedCount;

        if (start === 0 && added > 0) {
          await updateMap.mutateAsync({ tagGroups: tags.tagGroups });
          addedTags = added;
        }
      }
    } catch {
      // Whatever landed before the failure is real and already on the map. Going
      // quiet about it would leave the user thinking nothing was imported and
      // re-running the whole file on top of itself. With nothing saved there is
      // nowhere to send them, and the mutation's own error is already on screen.
      if (saved > 0) finish(saved, drafts.length, addedTags);
      return;
    }

    finish(saved, drafts.length, addedTags);
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
  addedTags,
}: {
  saved: number;
  total: number;
  addedTags: number;
}): string {
  const parts = [
    saved < total
      ? `${formatCount(saved)} of ${formatCount(total)} locations were saved before this stopped.`
      : `${formatCount(saved)} ${saved === 1 ? "location is" : "locations are"} on your map.`,
  ];

  if (addedTags > 0) {
    parts.push(
      `${formatCount(addedTags)} new ${
        addedTags === 1 ? "tag" : "tags"
      } came from your file.`,
    );
  }

  return parts.join(" ");
}
