import type { Place } from "@/lib/repositories/types";

/** Matches the placeholder names this module hands out, and only those. */
const PLACEHOLDER_NAME = /^Location (\d+)$/;

/**
 * Is this still the name we invented, rather than one the customer chose?
 *
 * The locations list asks, because "Location 3" identifies nothing and the
 * postcode does. A name the customer typed is theirs and stays on the row —
 * including "Location 14 (closed)", which is a deliberate name that merely starts
 * like ours, and which the same rule already refuses to renumber.
 */
export function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_NAME.test(name);
}

export type PlaceDefaults = {
  name: string;
  sortOrder: number;
};

/**
 * The name and position a pin gets when it is dropped on the map.
 *
 * Derived from the highest number already in use rather than from the list's
 * length, which was wrong in both directions: deleting "Location 2" of three made
 * the next drop a second "Location 3", and two pins dropped in the same second
 * both read the same length and landed as two "Location 4"s sharing a sortOrder.
 *
 * Only names of exactly the shape we generate are counted. A location the
 * customer has renamed is theirs, and reading a number out of
 * "Location 14 (closed)" would be us guessing at what they meant by it.
 */
export function nextPlaceDefaults(
  places: readonly Pick<Place, "name" | "sortOrder">[],
): PlaceDefaults {
  let highestNumber = 0;
  let highestSortOrder = -1;

  for (const place of places) {
    const match = PLACEHOLDER_NAME.exec(place.name);

    // Guarded, because the pattern accepts digits rather than sane numbers, and
    // "Location 99999999999999999999" would otherwise turn the next name into an
    // exponent.
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isSafeInteger(parsed)) {
        highestNumber = Math.max(highestNumber, parsed);
      }
    }

    highestSortOrder = Math.max(highestSortOrder, place.sortOrder);
  }

  return {
    // At least one past the count, so a map whose locations have all been renamed
    // gets a number that reads as a position rather than restarting at 1.
    name: `Location ${Math.max(highestNumber, places.length) + 1}`,
    sortOrder: highestSortOrder + 1,
  };
}
