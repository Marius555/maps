"use client";

import type { ReactNode } from "react";

import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { formatCoords } from "@/lib/map/geo";

/**
 * The matches a geocoder search came back with, as a list you pick from.
 *
 * Shared by the location form and the map toolbar. They differ in what picking
 * does — one moves a pin, the other moves the camera — but not in what a match
 * looks like, and two lists that agree today is the drift worth avoiding.
 *
 * Never applied automatically. The user picks, so a wrong guess costs nothing
 * (CLAUDE.md §7).
 *
 * A row is one press target with the action laid over it, rather than a button
 * and a button side by side. Nesting them would be invalid HTML, and putting the
 * action beside the row is what used to squeeze the address into a third of the
 * width — on a list whose entire job is letting you read the address.
 */
export function GeocodeResultList({
  candidates,
  emptyMessage,
  action,
  onPick,
}: {
  /** `null` means "no search has run yet", which renders nothing at all. */
  candidates: GeocodeCandidate[] | null;
  emptyMessage: string;
  /** An extra control per row, e.g. "Add location here". */
  action?: (candidate: GeocodeCandidate) => ReactNode;
  onPick: (candidate: GeocodeCandidate) => void;
}) {
  if (candidates === null) return null;

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted" role="status">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-1" aria-label="Address matches">
      {candidates.map((candidate, index) => (
        // Coordinates alone are not unique — a house and the street it is on can
        // come back on the same point — so the index disambiguates.
        <li key={`${candidate.lat},${candidate.lng},${index}`} className="relative">
          <button
            type="button"
            /*
             * No border: the row sits inside a bordered panel already, and a box
             * inside a box drew a double edge between every pair of matches. The
             * hover fill is the affordance, and `cursor-pointer` is the other
             * half of it — a bare <button> renders an arrow, so this row and the
             * HeroUI button on top of it used to disagree about what they were.
             */
            className="block min-h-11 w-full cursor-pointer rounded-lg px-3 py-2 pr-10 text-left transition-colors outline-none hover:bg-surface-secondary focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
            onClick={() => onPick(candidate)}
          >
            {/* Two lines before it gives up, not one. A match is chosen by
                reading it, and truncating mid-street hid the half that says
                which town. */}
            <span className="block line-clamp-2 text-sm text-foreground">
              {candidate.label || "Unnamed match"}
            </span>
            <span className="block text-xs tabular-nums text-muted">
              {formatCoords(candidate.lat, candidate.lng)}
            </span>
          </button>

          {/* Sat on the coordinates line, which is the row's quietest line and
              the one with room to spare. */}
          {action ? (
            <span className="absolute right-2 bottom-2 flex items-center">
              {action(candidate)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
