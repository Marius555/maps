import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { isValidLngLat, roundCoord } from "@/lib/map/geo";
import type { GeocodeStatus } from "@/lib/validation/place.schema";
import type { ColumnMapping } from "./column-mapping";
import { normalizeEmail, normalizeUrl } from "./contact";
import { parseCoordinate, parseLatLngPair } from "./coordinates";
import { ADDRESS_PARTS } from "./fields";
import { hasBlockingIssue, hasErrorOn, quoteValue, type RowIssue } from "./issues";
import { splitTagCell } from "./resolve-tags";
import type { SourceRow } from "./table";

/** A parsed row, keyed by header. */
export type CsvRow = SourceRow;

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
  /**
   * The raw tag text from the file, already split on , ; and |. Resolved to tag
   * ids on save, the same way `categoryLabel` is — a file has labels and a place
   * stores ids.
   */
  tagLabels: string[];
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
  /**
   * Everything wrong with this row, field by field. Never assigned by hand —
   * `recomputeIssues` owns it, and `patchDraft` runs it after every edit.
   */
  issues: RowIssue[];
  /**
   * The matches the geocoder ranked below the one we took.
   *
   * The batch endpoint has always returned these; until now they were dropped on
   * arrival, so a rough match could only be corrected by dragging a pin across a
   * country. One of these is usually the right answer.
   */
  alternatives: GeocodeCandidate[];
};

export type BuildDraftsResult = {
  drafts: DraftPlace[];
  /** Rows dropped as entirely blank. Reported so the count adds up for the user. */
  skippedBlankRows: number;
  /**
   * Website and email values that couldn't be made valid, and were cleared.
   *
   * The location itself is still imported — an optional contact field must never
   * cost the user a row (see contact.ts) — but the loss is counted here so the
   * review step can say so rather than quietly dropping data. Each loss is *also*
   * recorded as an issue on its own row, which is what makes it findable.
   */
  droppedContacts: number;
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
  let droppedContacts = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;

    if (isBlankRow(row)) {
      skippedBlankRows += 1;
      continue;
    }

    const name = cell(row, mapping.name);
    const address = composeAddress(row, mapping);
    const coordinates = readCoordinates(row, mapping);

    const rawEmail = cell(row, mapping.email);
    const rawUrl = cell(row, mapping.url);
    const email = normalizeEmail(rawEmail);
    const url = normalizeUrl(rawUrl);

    // Facts about what the file held, which no later edit can change. They are
    // the seed `recomputeIssues` carries forward; everything else it derives.
    const sourceIssues: RowIssue[] = [];

    if (coordinates.kind === "unreadable") {
      sourceIssues.push({
        field: "coordinates",
        severity: "warning",
        message: `Couldn't read ${quoteValue(coordinates.raw)} as coordinates.`,
      });
    }

    if (rawEmail && !email) {
      droppedContacts += 1;
      sourceIssues.push({
        field: "email",
        severity: "warning",
        message: `${quoteValue(rawEmail)} isn't an email address, so it was left out.`,
      });
    }

    if (rawUrl && !url) {
      droppedContacts += 1;
      sourceIssues.push({
        field: "url",
        severity: "warning",
        message: `${quoteValue(rawUrl)} isn't a website address, so it was left out.`,
      });
    }

    const draft: DraftPlace = {
      key: `row-${rowNumber}`,
      rowNumber,
      name,
      address,
      categoryLabel: cell(row, mapping.category),
      tagLabels: splitTagCell(cell(row, mapping.tags)),
      description: cell(row, mapping.description),
      phone: cell(row, mapping.phone),
      email,
      url,
      lat: coordinates.kind === "ok" ? coordinates.lat : null,
      lng: coordinates.kind === "ok" ? coordinates.lng : null,
      // Coordinates from the file are treated as deliberate, so a later geocode
      // pass leaves them alone.
      status: coordinates.kind === "ok" ? "manual" : "pending",
      matchedLabel: null,
      confidence: null,
      issues: sourceIssues,
      alternatives: [],
    };

    drafts.push({ ...draft, issues: recomputeIssues(draft) });
  }

  return { drafts, skippedBlankRows, droppedContacts };
}

/**
 * Fields whose issues describe the *file*, not the row's current state.
 *
 * These survive every edit, because editing a name does not un-mangle the
 * coordinate cell the file shipped with.
 */
const SOURCE_FIELDS = new Set<RowIssue["field"]>(["coordinates", "email", "url"]);

/**
 * Everything wrong with a draft right now.
 *
 * The single owner of `issues`, and the reason it exists is that the logic used
 * to be forked three ways — at build, in the review row's own `nextProblem`, and
 * as a blind `problem: null` written by the map's drag handler. That last one was
 * a live bug: dragging the pin of a row that had coordinates but no name cleared
 * its problem, let it into `importableDrafts` unnamed, and the whole import then
 * died in `preflightProblem`. One function, called from `patchDraft`, makes that
 * shape of bug unavailable.
 */
export function recomputeIssues(draft: DraftPlace): RowIssue[] {
  const carried = draft.issues.filter((issue) => {
    if (!SOURCE_FIELDS.has(issue.field)) return false;

    // A note about an unreadable coordinate cell is spent the moment someone
    // places the pin themselves — at that point it explains nothing they don't
    // already know, and it would sit there permanently on a row that is right.
    if (issue.field === "coordinates" && draft.status === "manual") return false;

    return true;
  });

  return [...carried, ...stateIssues(draft)];
}

function stateIssues(draft: DraftPlace): RowIssue[] {
  const issues: RowIssue[] = [];

  if (!draft.name.trim()) {
    issues.push({
      field: "name",
      severity: "error",
      message: "This row has no name. Add one, or skip the row.",
    });
  }

  if (draft.lat !== null && draft.lng !== null) {
    // Placed. The only thing left worth saying is how much to trust it.
    if (draft.status === "low") {
      issues.push({
        field: "address",
        severity: "warning",
        message: "Only a rough match. Check the pin, or pick another match.",
      });
    }

    return issues;
  }

  if (!draft.address.trim()) {
    issues.push({
      field: "address",
      severity: "error",
      message: "This row has no address and no coordinates, so it can't be placed.",
    });

    return issues;
  }

  // An address that hasn't been looked up and one that was looked up and found
  // nothing need opposite instructions, so they don't share a sentence.
  issues.push(
    draft.status === "pending"
      ? {
          field: "address",
          severity: "error",
          message:
            "This address hasn't been looked up yet. Search for it, or place the pin on the map.",
        }
      : {
          field: "address",
          severity: "error",
          message:
            "We couldn't find this address. Edit it and search again, or place the pin on the map.",
        },
  );

  return issues;
}

/**
 * Rows that still need a geocoder, in file order.
 *
 * Scoped to the *name* rather than to any blocking issue: an unplaced row's own
 * "hasn't been looked up yet" issue is blocking, and testing for that here would
 * make every queued row disqualify itself from the queue.
 */
export function draftsNeedingGeocode(drafts: DraftPlace[]): DraftPlace[] {
  return drafts.filter(
    (draft) =>
      draft.status === "pending" &&
      Boolean(draft.address) &&
      !hasErrorOn(draft.issues, "name"),
  );
}

/** Rows a human has to look at: no match, a vague match, or a broken row. */
export function draftsNeedingReview(drafts: DraftPlace[]): DraftPlace[] {
  return drafts.filter(
    (draft) =>
      draft.issues.length > 0 ||
      draft.status === "failed" ||
      draft.status === "low" ||
      draft.status === "pending" ||
      draft.lat === null ||
      draft.lng === null,
  );
}

/** Rows that can actually be saved. */
export function importableDrafts(drafts: DraftPlace[]): DraftPlace[] {
  return drafts.filter(
    (draft) =>
      !hasBlockingIssue(draft.issues) && draft.lat !== null && draft.lng !== null,
  );
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

/**
 * What the coordinate columns said, including when they said something unusable.
 *
 * "No coordinate column" and "a coordinate column holding invalid_geo" used to
 * both come back as `null`, so the second one vanished without trace — the pin
 * ended up wherever the address geocoded to and nothing ever mentioned the cell
 * that had been thrown away. Telling them apart is the whole reason this returns
 * a shape rather than a nullable pair.
 */
type CoordinateRead =
  | { kind: "none" }
  | { kind: "ok"; lat: number; lng: number }
  | { kind: "unreadable"; raw: string };

/**
 * A position, from whichever columns the file actually has.
 *
 * The combined column wins when it parses: a file with both is one where the
 * user pointed at the single cell holding a real pair, and the separate columns
 * are usually the half-filled ones that made them do it.
 */
function readCoordinates(row: CsvRow, mapping: ColumnMapping): CoordinateRead {
  const combinedRaw = cell(row, mapping.latlng);
  const latRaw = cell(row, mapping.lat);
  const lngRaw = cell(row, mapping.lng);

  const combined = combinedRaw ? parseLatLngPair(combinedRaw) : null;
  if (combined) {
    const rounded = round(combined.lat, combined.lng);
    if (rounded) return { kind: "ok", ...rounded };
  }

  const lat = parseCoordinate(latRaw);
  const lng = parseCoordinate(lngRaw);
  if (lat !== null && lng !== null) {
    const rounded = round(lat, lng);
    if (rounded) return { kind: "ok", ...rounded };
  }

  const raw = [combinedRaw, latRaw, lngRaw].filter(Boolean).join(", ");
  return raw ? { kind: "unreadable", raw } : { kind: "none" };
}

function round(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!isValidLngLat(lng, lat)) return null;

  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

export { parseCoordinate };
