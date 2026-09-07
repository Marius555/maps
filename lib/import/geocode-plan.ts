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
 * Roughly how long a plan will take, in milliseconds.
 *
 * Said out loud before the run starts, because the honest answer for a large
 * file is minutes and a progress bar that appears with no number beside it
 * reads as a hang. It is deliberately a floor plus a per-request allowance
 * rather than a measured average: we know the pace the server is holding
 * (`paceMs`, which the batch endpoint reports so this is not a client-side copy
 * of a provider's rate limit), and the rest is one round trip's latency per
 * chunk, which the caller refines once the first chunk has actually landed.
 */
export function estimateGeocodeMs({
  lookupCount,
  paceMs,
  batchSize,
  latencyMs = 400,
}: {
  lookupCount: number;
  paceMs: number;
  batchSize: number;
  latencyMs?: number;
}): number {
  if (lookupCount === 0) return 0;

  const chunks = Math.ceil(lookupCount / batchSize);

  return lookupCount * paceMs + chunks * latencyMs;
}
