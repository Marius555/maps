"use client";

import { Button, Label, ProgressBar } from "@heroui/react";
import { useMemo, useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { formatCount } from "@/lib/format/number";
import {
  draftsNeedingReview,
  importableDrafts,
  type DraftPlace,
} from "@/lib/import/draft-places";
import { hasBlockingIssue } from "@/lib/import/issues";
import type { AppMap } from "@/lib/repositories/types";
import { useImportStore } from "@/lib/stores/import-store";
import type { ImportProgress } from "../import-wizard";
import { ReviewList } from "./review-list";
import { ReviewMap } from "./review-map";
import { ReviewSummary } from "./review-summary";

/** Built per branch rather than by patching plurals into one sentence. */
function reviewSentence(count: number): string {
  if (count === 0) return "Everything found a good match.";

  if (count === 1) {
    return "1 needs a look — drag its pin, or open Fix to edit it.";
  }

  return `${formatCount(count)} need a look — drag their pins, or open Fix to edit them.`;
}

/**
 * Step 4: check the results before anything is written.
 *
 * This step is the whole reason geocoding doesn't save directly (CLAUDE.md §7).
 * Every pin is draggable, every row is editable, rows that need attention are
 * listed first, and nothing reaches the database until Import is pressed.
 *
 * The map is the full width of the panel with the list under it. Reviewing is a
 * two-handed job — read the row, look at where its pin went, correct one of them
 * — so from `lg` up the map sticks to the top of the viewport and the list
 * scrolls under it. That is what the two-column layout this replaced was for,
 * and a half-width map was a poor way to get it: a pin two streets from where it
 * belongs is invisible in 400px of canvas.
 */
export function ReviewStep({
  map,
  headroom,
  isImporting,
  importProgress,
  importError,
  onImport,
  onBack,
}: {
  map: AppMap;
  headroom: { plan: string; limit: number; used: number };
  isImporting: boolean;
  /** How far the confirmed write has got, or null when one isn't running. */
  importProgress: ImportProgress | null;
  importError: unknown;
  onImport: () => void;
  onBack: () => void;
}) {
  const drafts = useImportStore((state) => state.drafts);
  const skippedBlankRows = useImportStore((state) => state.skippedBlankRows);
  const droppedContacts = useImportStore((state) => state.droppedContacts);
  const geocodeError = useImportStore((state) => state.geocodeError);
  const patchDraft = useImportStore((state) => state.patchDraft);
  const removeDraft = useImportStore((state) => state.removeDraft);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [placingKey, setPlacingKey] = useState<string | null>(null);
  const [showOnlyProblems, setShowOnlyProblems] = useState(true);

  /*
   * Rows showing their editing controls.
   *
   * Seeded once, from the rows that can't be imported as they stand — by the time
   * this step mounts every draft is built and geocoded, and no new ones appear
   * after it. Held here rather than in each row because an open row is also a row
   * that stays listed: without that, typing the first letter of a missing name
   * fixes the row, drops it out of the filtered list, and takes the field away
   * mid-keystroke.
   */
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        drafts
          .filter((draft) => hasBlockingIssue(draft.issues))
          .map((draft) => draft.key),
      ),
  );

  const needsReview = useMemo(() => draftsNeedingReview(drafts), [drafts]);
  const importable = useMemo(() => importableDrafts(drafts), [drafts]);
  const unplaced = useMemo(
    () => drafts.filter((draft) => draft.lat === null || draft.lng === null).length,
    [drafts],
  );

  const listed = useMemo(() => {
    if (!showOnlyProblems || needsReview.length === 0) return drafts;

    const flagged = new Set(needsReview.map((draft) => draft.key));

    // A row the user has open stays, however tidy it has just become. It leaves
    // when they press Done — which is better feedback than vanishing mid-edit,
    // because they said they were finished with it.
    return drafts.filter(
      (draft) => flagged.has(draft.key) || openKeys.has(draft.key),
    );
  }, [drafts, needsReview, openKeys, showOnlyProblems]);

  const description =
    `${formatCount(importable.length)} of ${formatCount(drafts.length)} rows are ready. ` +
    reviewSentence(needsReview.length);

  /**
   * The plan check, in front of the button rather than behind it.
   *
   * The server enforces this either way (CLAUDE.md §6) — but finding out from a
   * 403 after a ten-minute address lookup, with some rows already written, is
   * the worst way to learn it. Saying it here costs one subtraction.
   */
  const remaining = Math.max(headroom.limit - headroom.used, 0);
  const overLimit = importable.length > remaining;

  const patch = (
    key: string,
    next: Partial<DraftPlace>,
    options?: { fromMap?: boolean },
  ) => {
    patchDraft(key, next);

    if (next.lat === undefined) return;

    // A click that placed a row has spent the arming. Leaving it armed would make
    // the next click move a row the user had stopped thinking about.
    if (key === placingKey) setPlacingKey(null);

    // A position that came from the list — a typed coordinate, a picked address,
    // a chosen alternative — is somewhere the user cannot currently see. Selecting
    // it is what sends the camera after it, so the correction is visible rather
    // than taken on trust.
    if (!options?.fromMap) setSelectedKey(key);
  };

  return (
    /*
     * No `SectionPanel`, for the reason the other three steps lost theirs: a
     * white card on a grey page, holding a map frame and a list of bordered
     * boxes, was three surfaces deep for one screen. The step sits on the page.
     *
     * The actions come with the heading rather than sitting in a footer under
     * the list. The list is as long as the file — on a three-thousand-row import
     * a footer is thousands of pixels below the map you are working against, and
     * the map is `lg:sticky` precisely because this screen is worked from the
     * top.
     */
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-muted">{description}</p>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="tertiary" onPress={onBack}>
            Back to columns
          </Button>
          <Button
            isPending={isImporting}
            isDisabled={importable.length === 0 || overLimit}
            onPress={onImport}
          >
            Import {formatCount(importable.length)}{" "}
            {importable.length === 1 ? "location" : "locations"}
          </Button>
        </div>
      </div>

      <ReviewSummary
        drafts={drafts}
        importable={importable.length}
        needsReview={needsReview.length}
        unplaced={unplaced}
        skippedBlankRows={skippedBlankRows}
        droppedContacts={droppedContacts}
        geocodeError={geocodeError}
      />

      {overLimit ? (
        <ErrorMessage
          error={`This would be ${formatCount(importable.length)} locations and your ${headroom.plan} plan has room for ${formatCount(remaining)} more. Skip some rows below, or upgrade your plan.`}
        />
      ) : null}

      <div className="space-y-3">
        {/*
         * Sticky only from `lg`: below it the mobile header is what owns the
         * top of the viewport, and a map sliding under it reads as a bug.
         *
         * Its height is capped against the viewport as well as in rems, because
         * a sticky element is spending screen the list also needs — 24rem of map
         * in a 40rem window leaves four rows visible, and the row being fixed
         * ends up permanently behind it.
         */}
        {/* `bg-background`, not `bg-surface`: this is what shows for the frame
            or two before MapLibre paints, and a white flash on a grey page is a
            worse tell than the page's own colour. The border stays — a map has
            an edge whatever it is sitting on. */}
        <div className="h-64 overflow-hidden rounded-xl border border-border bg-background sm:h-80 lg:sticky lg:top-4 lg:z-10 lg:h-[min(24rem,40vh)]">
          <ReviewMap
            map={map}
            drafts={drafts}
            selectedKey={selectedKey}
            placingKey={placingKey}
            onSelect={setSelectedKey}
            onPatch={patch}
          />
        </div>

        <ReviewList
          drafts={listed}
          mapId={map.id}
          needsReviewCount={needsReview.length}
          showOnlyProblems={showOnlyProblems}
          selectedKey={selectedKey}
          placingKey={placingKey}
          openKeys={openKeys}
          onShowOnlyProblemsChange={setShowOnlyProblems}
          onSelect={setSelectedKey}
          onPatch={patch}
          onRemove={removeDraft}
          onTogglePlacing={(key) =>
            setPlacingKey((current) => (current === key ? null : key))
          }
          onToggleOpen={(key) =>
            setOpenKeys((current) => {
              const next = new Set(current);
              if (!next.delete(key)) next.add(key);
              return next;
            })
          }
        />
      </div>

      {/*
       * The write has its own progress, because it is not instant either.
       *
       * A three-thousand-row import is fifteen sequential requests of two
       * hundred rows, and all the user had was a pending button — for long
       * enough to look like a page that had stopped responding. It reports rows
       * rather than requests for the same reason the address lookup does: the
       * number has to mean something the user can see in their own file.
       */}
      {importProgress ? (
        <ProgressBar
          aria-label="Import progress"
          className="w-full"
          value={Math.round(
            (importProgress.saved / Math.max(importProgress.total, 1)) * 100,
          )}
        >
          <Label>
            {formatCount(importProgress.saved)} of{" "}
            {formatCount(importProgress.total)} locations saved
          </Label>
          <ProgressBar.Output />
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      ) : null}

      {importError ? <ErrorMessage error={importError} /> : null}
    </div>
  );
}
