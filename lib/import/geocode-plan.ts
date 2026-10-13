import { draftsNeedingGeocode, type DraftPlace } from "./draft-places";

/**
 * What a file will actually cost the geocoder, worked out before spending any
 * of it.
 *
 * Every lookup is a request against a rate-limited, metered upstream, and the
 * geocoder only ever runs here — at import time, never in a visitor's path
 * (CLAUDE.md §2). So the cheapest request is the one we can prove we already
 * made: a stockist list routinely holds several rows at one address (suites in
 * a building, departments on a campus, two brands in one retail park), and a
 * three-thousand-row file with four hundred repeats was three thousand
 * requests. It is now two thousand six hundred.
 *
 * The saving is free when there is none to make. A file with no repeated
 * address produces one lookup per row and this whole module is a `Map` build.
 *
 * **This does not decide what a row means, only how many times to ask.** The
 * answer is fanned back out per row through `patchDraft`, so `recomputeIssues`
 * runs against each row's own contents exactly as it did when every row had its
 * own request — see `draft-places.ts`, which is the only thing allowed to
 * derive a row's issues.
 */
export type GeocodeLookup = {
  /**
   * The address to send. The *first* row's raw text, not the normalised key:
   * normalising is how we decide two rows are the same question, and it is not
   * a better question to ask than the one the user actually wrote.
   */
  address: string;
  /** Every draft key that gets this lookup's answer. At least one. */
  keys: string[];
};

export type GeocodePlan = {
  /** One entry per distinct address, in the order the rows first appear. */
  lookups: GeocodeLookup[];
  /** Rows that need an address looked up at all. */
  rowCount: number;
  /** Requests those rows will actually cost. Never more than `rowCount`. */
  lookupCount: number;
  /** `rowCount - lookupCount`: requests the repeats saved. */
  savedCount: number;
};

/**
 * Two addresses are the same question when they differ only in the ways a
 * spreadsheet differs from itself.
 *
 * Case, leading and trailing space, and runs of whitespace — including the ones
 * a CSV export leaves after a comma, which is why the collapse happens after
 * trimming and not instead of it. Deliberately *not* smarter than that: folding
 * "St" into "Street" or dropping punctuation would merge two addresses the
 * geocoder itself would distinguish, and a wrong merge writes one building's
 * coordinates onto another's row, silently, on rows nobody flagged.
 */
export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Group the rows still needing coordinates into one lookup per distinct address.
 *
 * Insertion-ordered, so the run walks the file top to bottom and the progress
 * bar advances in the order the user's own rows do. `Map` gives that for free.
 */
export function planGeocode(drafts: DraftPlace[]): GeocodePlan {
  const pending = draftsNeedingGeocode(drafts);
  const byAddress = new Map<string, GeocodeLookup>();

  for (const draft of pending) {
    const key = normalizeAddress(draft.address);
    const existing = byAddress.get(key);

    if (existing) {
      existing.keys.push(draft.key);
      continue;
    }

    byAddress.set(key, { address: draft.address, keys: [draft.key] });
  }

  const lookups = [...byAddress.values()];

  return {
    lookups,
    rowCount: pending.length,
    lookupCount: lookups.length,
    savedCount: pending.length - lookups.length,
  };
}

/**
 * Where the file's other rows went, for the sentence above the progress bar.
 *
 * The bar counts only the rows that need an address looked up, so a 40-row file
 * with 37 rows of coordinates says "0 of 3", which reads as the import having
 * lost most of the file unless the screen also says where the other 37 are.
 */
export type GeocodeScope = {
  /** Every row in the run. */
  totalCount: number;
  /** Rows that already have a pin: coordinates from the file, or looked up earlier in a resumed run. */
  placedCount: number;
  /** Rows that neither have a pin nor will get one here: no address, or no name. Review flags them. */
  skippedCount: number;
};

export function summarizeGeocodeScope(drafts: DraftPlace[]): GeocodeScope {
  const needing = draftsNeedingGeocode(drafts).length;
  const placedCount = drafts.filter(
    (draft) => draft.lat !== null && draft.lng !== null,
  ).length;

  return {
    totalCount: drafts.length,
    placedCount,
    skippedCount: Math.max(drafts.length - needing - placedCount, 0),
  };
}
