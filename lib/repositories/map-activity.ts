/**
 * What the maps list says about how recently a map changed.
 *
 * The map row's own `updatedAt` does not move when a location is edited, so the
 * list reads the newest row of each table on the map as well and reports the
 * newest of them all (map-summary.repository.ts).
 */

export type TableActivity = {
  /** Rows on this map. */
  count: number;
  /** The newest row's `$updatedAt`, or null for an empty table. */
  last: string | null;
};

/** The newest of several ISO timestamps. Nulls are skipped. */
export function latestOf(first: string, ...rest: (string | null)[]): string {
  let latest = first;

  for (const candidate of rest) {
    if (candidate && Date.parse(candidate) > Date.parse(latest)) latest = candidate;
  }

  return latest;
}
