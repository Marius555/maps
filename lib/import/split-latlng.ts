import { roundCoord } from "@/lib/map/geo";
import { parseLatLngPair } from "./coordinates";
import { uniqueName, type SourceRow } from "./table";

/**
 * One coordinate column becomes two.
 *
 * A single "52.5200, 13.4050" column already imports correctly — `readCoordinates`
 * in `draft-places.ts` reads it and prefers it over a separate pair. This is not
 * about making the file work; it is about making it *legible*. A user looking at
 * a column headed "Latitude and longitude together" cannot see, cell by cell,
 * which half is which or whether we read the pair the way they meant it. Two
 * columns of plain numbers can be scanned, and a wrong one can be corrected in
 * place.
 *
 * Pure, and separate from the store, because the interesting cases are all about
 * the *values* — a decimal comma, a Google Maps link, degrees-minutes-seconds, a
 * cell reading "n/a" — and those deserve a test rather than a click-through.
 */
export type SplitLatLngResult = {
  headers: string[];
  rows: SourceRow[];
  latHeader: string;
  lngHeader: string;
  /**
   * Rows that held something we couldn't read as a pair, and whose two new cells
   * are therefore empty.
   *
   * Blank cells are not counted: they were already blank, and reporting them as
   * losses would put a scary number on a file that lost nothing.
   */
  unparsed: number;
};

/**
 * Is there anything in this column to split?
 *
 * Asked on every render so the action can be hidden rather than shown and then
 * refused. Short-circuits on the first readable cell, which for a real
 * coordinate column is row one.
 */
export function canSplitLatLng(rows: SourceRow[], header: string): boolean {
  return rows.some((row) => parseLatLngPair(row[header] ?? "") !== null);
}

export function splitLatLngColumn(
  headers: string[],
  rows: SourceRow[],
  header: string,
): SplitLatLngResult | null {
  const index = headers.indexOf(header);
  if (index === -1) return null;

  const pairs = rows.map((row) => parseLatLngPair(row[header] ?? ""));

  // Removing a column that yields nothing would be data loss dressed up as a
  // fix. The caller uses null to hide the action entirely.
  if (!pairs.some((pair) => pair !== null)) return null;

  // The combined column is on its way out, so its own name is free for reuse —
  // a column literally called "Latitude and longitude" doesn't force a suffix.
  const taken = new Set(headers.filter((candidate) => candidate !== header));
  const latHeader = uniqueName("Latitude", taken);
  taken.add(latHeader);
  const lngHeader = uniqueName("Longitude", taken);

  const nextHeaders = [...headers];
  nextHeaders.splice(index, 1, latHeader, lngHeader);

  const nextRows = rows.map((row, rowIndex) => {
    const next: SourceRow = {};

    for (const key of Object.keys(row)) {
      if (key !== header) next[key] = row[key];
    }

    const pair = pairs[rowIndex];
    next[latHeader] = pair ? String(roundCoord(pair.lat)) : "";
    next[lngHeader] = pair ? String(roundCoord(pair.lng)) : "";

    return next;
  });

  const unparsed = rows.filter(
    (row, rowIndex) => pairs[rowIndex] === null && (row[header] ?? "").trim() !== "",
  ).length;

  return { headers: nextHeaders, rows: nextRows, latHeader, lngHeader, unparsed };
}
