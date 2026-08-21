"use client";

import { GeocodeResultList } from "@/components/geocode/geocode-result-list";
import type { GeocodeCandidate } from "@/lib/geocoding/types";

/**
 * The matches the geocoder ranked below the one we took.
 *
 * The batch endpoint asks for five candidates and has always returned the four it
 * didn't pick, with a comment saying they were there "so the review step can
 * offer alternatives" — and then the review step dropped them on arrival. So the
 * only way to correct a rough match was to drag its pin, sometimes across a
 * country, when the right answer was usually sitting second in a list nobody
 * could see.
 *
 * Behind a disclosure because on a good import this is noise on every row: the
 * best match is right and the count is the only thing worth showing until asked.
 * A native `<details>` rather than a component, the same choice `SkippedGroup`
 * makes in the mapping step — it is keyboard-operable and needs no state.
 */
export function RowAlternatives({
  candidates,
  onPick,
}: {
  candidates: GeocodeCandidate[];
  onPick: (candidate: GeocodeCandidate) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <details className="rounded-lg bg-surface-secondary px-2 py-1.5">
      <summary className="cursor-pointer text-xs text-muted outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus">
        {candidates.length === 1
          ? "1 other match"
          : `${candidates.length} other matches`}
      </summary>

      <div className="pt-1.5">
        <GeocodeResultList
          candidates={candidates}
          emptyMessage=""
          onPick={onPick}
        />
      </div>
    </details>
  );
}
