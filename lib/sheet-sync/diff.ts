import type { DraftPlace } from "@/lib/import/draft-places";
import { normalizeKeyPart } from "./row-key";

/** A usable row of the sheet, with the key `sourceKeysFor` gave it. */
export type SheetRow = { key: string; draft: DraftPlace };

/** The least of a location a sync needs in order to match it. */
export type LinkedPlace = {
  id: string;
  name: string;
  address: string;
  sourceKey: string;
};

export type SheetDiff<P extends LinkedPlace> = {
  /** A row and the location it already is. May still have nothing to change. */
  matches: { place: P; row: SheetRow }[];
  /** Rows with no location yet. */
  adds: SheetRow[];
  /** Sheet-linked locations whose row is gone. */
  removals: P[];
};

/**
 * The sheet, against the locations that came from it.
 *
 * `existing` must already be narrowed to locations *with* a `sourceKey`. One
 * added by hand has none, and a sync never matches, changes or removes it — that
 * is what lets an owner keep a pin of their own on a map that follows a sheet.
 *
 * Three passes, each only over what the earlier ones left unmatched:
 *
 * 1. **The key.** Name and address both unchanged. Nearly every row, nearly every
 *    time.
 * 2. **The name, when it is unique on both sides.** The address changed — a shop
 *    moved, a typo was fixed — and the location it was is still the one with
 *    that name.
 * 3. **The address, when it is unique on both sides.** The location was renamed.
 *
 * Passes 2 and 3 are what keep a location's photos, logo, custom pin and card
 * overrides through an edit to its row. They only ever match one-to-one, so two
 * rows called "Main Street Store" never guess at which location is which; those
 * fall through to an add and a removal, exactly as changing both the name and
 * the address at once does.
 */
export function diffSheet<P extends LinkedPlace>(
  existing: readonly P[],
  rows: readonly SheetRow[],
): SheetDiff<P> {
  const matches: { place: P; row: SheetRow }[] = [];

  const byKey = new Map<string, P>();
  const unmatchedPlaces = new Set<P>();

  for (const place of existing) {
    // A key held twice is a location written twice for one row; the first keeps
    // it and the rest are left to the later passes, or to removal.
    if (byKey.has(place.sourceKey)) {
      unmatchedPlaces.add(place);
      continue;
    }

    byKey.set(place.sourceKey, place);
    unmatchedPlaces.add(place);
  }

  let unmatchedRows: SheetRow[] = [];

  for (const row of rows) {
    const place = byKey.get(row.key);

    if (place && unmatchedPlaces.has(place)) {
      unmatchedPlaces.delete(place);
      matches.push({ place, row });
    } else {
      unmatchedRows.push(row);
    }
  }

  for (const readKey of [
    (value: { name: string }) => normalizeKeyPart(value.name),
    (value: { address: string }) => normalizeKeyPart(value.address),
  ]) {
    if (unmatchedRows.length === 0 || unmatchedPlaces.size === 0) break;

    const placesByValue = groupBy([...unmatchedPlaces], (place) => readKey(place));
    const rowsByValue = groupBy(unmatchedRows, (row) => readKey(row.draft));

    const stillUnmatched: SheetRow[] = [];

    for (const row of unmatchedRows) {
      const value = readKey(row.draft);
      const places = value ? placesByValue.get(value) : undefined;
      const sameRows = value ? rowsByValue.get(value) : undefined;

      if (places?.length === 1 && sameRows?.length === 1) {
        unmatchedPlaces.delete(places[0]);
        matches.push({ place: places[0], row });
      } else {
        stillUnmatched.push(row);
      }
    }

    unmatchedRows = stillUnmatched;
  }

  return { matches, adds: unmatchedRows, removals: [...unmatchedPlaces] };
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;

    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  return groups;
}
