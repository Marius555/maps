import { isApproximate, needsReview } from "@/lib/geocoding/confidence";
import type { Place } from "@/lib/repositories/types";
import { isIncomplete } from "./completeness";

/**
 * Finding the locations that need work.
 *
 * The Locations tab could search by name and filter by category, and that was
 * all — so on a 300-row import the question "which of these went wrong" had no
 * answer on the page. The status flags were there, one per row, and finding them
 * meant reading 300 rows.
 *
 * Every predicate here is built on `lib/geocoding/confidence.ts` rather than on a
 * threshold of its own. `needsReview` and `isApproximate` already encode what
 * "suspect" means and why the two are different, and a second copy of 0.8 in a
 * filter is how a row starts being flagged in the list and not by the filter
 * meant to find it.
 */

export const PLACE_FILTERS = [
  "",
  "attention",
  "failed",
  "low",
  "approximate",
  "incomplete",
] as const;

export type PlaceFilter = (typeof PLACE_FILTERS)[number];

export const PLACE_FILTER_LABELS: Record<PlaceFilter, string> = {
  "": "All locations",
  attention: "Needs attention",
  failed: "Not placed",
  low: "Rough match",
  approximate: "Approximate address",
  incomplete: "Missing details",
};

/**
 * A pin we aren't sure about, either way round.
 *
 * The union of the two: a geocoded pin that may be in the wrong place, and a
 * hand-placed pin whose address only reached the street. They ask for opposite
 * fixes — see `place-status-flag.tsx` — but "show me what to look at" wants both.
 */
export function needsAttention(place: Place): boolean {
  return (
    needsReview(place.geocodeStatus) ||
    isApproximate(place.geocodeStatus, place.geocodeConfidence)
  );
}

export function matchesFilter(place: Place, filter: PlaceFilter): boolean {
  switch (filter) {
    case "":
      return true;
    case "attention":
      return needsAttention(place);
    case "failed":
      return place.geocodeStatus === "failed";
    case "low":
      return place.geocodeStatus === "low";
    case "approximate":
      return isApproximate(place.geocodeStatus, place.geocodeConfidence);
    case "incomplete":
      return isIncomplete(place);
  }
}

export function countNeedingAttention(places: Place[]): number {
  return places.filter(needsAttention).length;
}
