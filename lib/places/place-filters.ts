import { isApproximate, needsReview } from "@/lib/geocoding/confidence";
import type { Place } from "@/lib/repositories/types";
import { matchesTags } from "@/packages/shared/tags";
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

/**
 * "Untagged", carried inside the tag selection rather than beside it.
 *
 * The Category picker had a "No category" option and losing it with the merge
 * would lose the one question an owner actually asks after an import: which
 * locations did nothing land on. A sentinel in the same set as the real tag ids
 * keeps that a single piece of state, and one control, instead of a boolean the
 * toolbar has to thread separately.
 *
 * Not a real tag id, and it can never collide with one — `newTagId` mints
 * `tag-…` and a migrated category is `cat-…`.
 */
export const UNTAGGED_FILTER_ID = "__untagged";

/**
 * The tag half of the list filter.
 *
 * Untagged is **exclusive**: a location wearing nothing cannot also wear Bikes,
 * so combining the two can only ever return an empty list, and a filter that can
 * be put into a state with no possible answer is a filter that reads as broken.
 * `TagFilterMenu` enforces that at the control; this answers the same way if
 * anything ever gets past it.
 *
 * Everything else is `matchesTags` — the embed's own function, imported and not
 * reimplemented, so the owner's filtered list and the visitor's filtered map
 * cannot come to disagree about what "sells bikes and opens Sundays" means.
 */
export function matchesTagFilter(
  place: Place,
  selected: ReadonlySet<string>,
  groupOf: ReadonlyMap<string, string>,
): boolean {
  if (selected.has(UNTAGGED_FILTER_ID)) return place.tags.length === 0;

  return matchesTags(place.tags, selected, groupOf);
}
