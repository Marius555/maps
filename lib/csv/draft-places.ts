import { isValidLngLat, roundCoord } from "@/lib/map/geo";
import type { GeocodeStatus } from "@/lib/validation/place.schema";
import type { ColumnMapping } from "./column-mapping";
import { ADDRESS_PARTS } from "./fields";

/** A parsed CSV row, keyed by header. */
export type CsvRow = Record<string, string>;

/**
 * "pending" means this row still needs geocoding. Everything else is one of the
 * statuses that can land in the database.
 */
export type DraftStatus = "pending" | GeocodeStatus;

/**
 * A row on its way to becoming a place.
 *
 * Lives only in the browser until the review step is confirmed. Nothing here is
 * written silently — CLAUDE.md §7.
 */
export type DraftPlace = {
  /** Stable across re-renders and geocode round trips. */
  key: string;
  /** 1-based data row, matching what the user sees in a spreadsheet. */
  rowNumber: number;
  name: string;
  /** Address parts joined; this is what gets geocoded and stored. */
  address: string;
  /** The raw category text from the file. Resolved to a category id on save. */
  categoryLabel: string;
  description: string;
  phone: string;
  email: string;
  url: string;
  lat: number | null;
  lng: number | null;
  status: DraftStatus;
  /** What the geocoder matched, shown in the review list. */
  matchedLabel: string | null;
  confidence: number | null;
  /** Set when the row can't be imported at all, e.g. it has no name. */
  problem: string | null;
};

export type BuildDraftsResult = {
  drafts: DraftPlace[];
  /** Rows dropped as entirely blank. Reported so the count adds up for the user. */
  skippedBlankRows: number;
};

/**
 * Rows + mapping → drafts.
 *
 * Pure: no geocoding, no network, no writes. Every judgement it makes is visible
 * in the review step before anything is saved.
 */
export function buildDraftPlaces(
  rows: CsvRow[],
  mapping: ColumnMapping,
): BuildDraftsResult {
  const drafts: DraftPlace[] = [];
  let skippedBlankRows = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;

    if (isBlankRow(row)) {
      skippedBlankRows += 1;
      continue;
    }

    const name = cell(row, mapping.name);
    const address = composeAddress(row, mapping);
    const coordinates = readCoordinates(row, mapping);

    drafts.push({
      key: `row-${rowNumber}`,
      rowNumber,
      name,
      address,
      categoryLabel: cell(row, mapping.category),
      description: cell(row, mapping.description),
      phone: cell(row, mapping.phone),
      email: cell(row, mapping.email),
      url: cell(row, mapping.url),
      lat: coordinates?.lat ?? null,
      lng: coordinates?.lng ?? null,
      // Coordinates from the file are treated as deliberate, so a later geocode
      // pass leaves them alone.
      status: coordinates ? "manual" : "pending",
      matchedLabel: null,
      confidence: null,
      problem: rowProblem({ name, address, hasCoordinates: Boolean(coordinates) }),
    });
  }

  return { drafts, skippedBlankRows };
}

/** Rows that still need a geocoder, in file order. */
export function draftsNeedingGeocode(drafts: DraftPlace[]): DraftPlace[] {
  return drafts.filter(
    (draft) => draft.status === "pending" && !draft.problem && draft.address,
  );
}

/** Rows a human has to look at: no match, a vague match, or a broken row. */
export function draftsNeedingReview(drafts: DraftPlace[]): DraftPlace[] {
  return drafts.filter(
    (draft) =>
      draft.problem !== null ||
      draft.status === "failed" ||
      draft.status === "low" ||
      draft.lat === null ||
      draft.lng === null,
  );
}

/** Rows that can actually be saved. */
export function importableDrafts(drafts: DraftPlace[]): DraftPlace[] {
  return drafts.filter(
    (draft) => !draft.problem && draft.lat !== null && draft.lng !== null,
  );
}

function rowProblem({
  name,
  address,
  hasCoordinates,
}: {
  name: string;
  address: string;
  hasCoordinates: boolean;
}): string | null {
  if (!name) return "This row has no name. Add one, or skip the row.";

  if (!address && !hasCoordinates) {
    return "This row has no address and no coordinates, so it can't be placed.";
  }

  return null;
}

function isBlankRow(row: CsvRow): boolean {
  return Object.values(row).every((value) => !value || !value.trim());
}

function cell(row: CsvRow, header: string | undefined): string {
  if (!header) return "";
  return (row[header] ?? "").trim();
}

/**
 * Joins whichever address parts were mapped. Deduplicated because exports often
 * repeat the city inside a full-address column.
 */
function composeAddress(row: CsvRow, mapping: ColumnMapping): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const part of ADDRESS_PARTS) {
    const value = cell(row, mapping[part]);
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    parts.push(value);
  }

  return parts.join(", ");
}

function readCoordinates(
  row: CsvRow,
  mapping: ColumnMapping,
): { lat: number; lng: number } | null {
  const lat = parseCoordinate(cell(row, mapping.lat));
  const lng = parseCoordinate(cell(row, mapping.lng));

  if (lat === null || lng === null) return null;
  if (!isValidLngLat(lng, lat)) return null;

  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

/**
 * Accepts a decimal comma. Exports from European spreadsheets write "54,687",
 * and reading that as 54 would drop the location in the wrong country.
 */
export function parseCoordinate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized =
    trimmed.includes(",") && !trimmed.includes(".")
      ? trimmed.replace(",", ".")
      : trimmed;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
