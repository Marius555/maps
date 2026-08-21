"use client";

import { AnimatePresence } from "motion/react";

import type { DraftPlace } from "@/lib/import/draft-places";
import { ReviewRow } from "./review-row/review-row";

/**
 * The rows, and the filter that hides the ones already fine.
 *
 * No inner scroller. It had one so the map stayed in view beside it; the map is
 * now above the list and sticks there, so a second scrollbar inside the page
 * would only make the list harder to get through.
 */
export function ReviewList({
  drafts,
  mapId,
  needsReviewCount,
  showOnlyProblems,
  selectedKey,
  placingKey,
  openKeys,
  onShowOnlyProblemsChange,
  onSelect,
  onPatch,
  onRemove,
  onTogglePlacing,
  onToggleOpen,
}: {
  drafts: DraftPlace[];
  mapId: string;
  needsReviewCount: number;
  showOnlyProblems: boolean;
  selectedKey: string | null;
  placingKey: string | null;
  /** Rows showing their editing controls. See `ReviewRow` for why it lives here. */
  openKeys: ReadonlySet<string>;
  onShowOnlyProblemsChange: (value: boolean) => void;
  onSelect: (key: string) => void;
  onPatch: (key: string, patch: Partial<DraftPlace>) => void;
  onRemove: (key: string) => void;
  onTogglePlacing: (key: string) => void;
  onToggleOpen: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      {needsReviewCount > 0 ? (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={showOnlyProblems}
            onChange={(event) => onShowOnlyProblemsChange(event.target.checked)}
          />
          Show only rows that need attention
        </label>
      ) : null}

      <ul className="space-y-1.5">
        {/*
         * Rows fade out as they are removed, and as they leave the filtered set
         * when "only rows that need attention" is on — fixing a row and watching
         * it go is the feedback that says the fix took.
         */}
        <AnimatePresence initial={false}>
          {drafts.map((draft) => (
            <ReviewRow
              key={draft.key}
              draft={draft}
              mapId={mapId}
              isSelected={draft.key === selectedKey}
              isPlacing={draft.key === placingKey}
              isOpen={openKeys.has(draft.key)}
              onSelect={() => onSelect(draft.key)}
              onChange={(patch) => onPatch(draft.key, patch)}
              onRemove={() => onRemove(draft.key)}
              onTogglePlacing={() => onTogglePlacing(draft.key)}
              onToggleOpen={() => onToggleOpen(draft.key)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
