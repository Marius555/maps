import { detectHeaderRow } from "./detect/header-row";
import { MAX_SOURCE_ROWS } from "./limits";
import { ImportSourceError, type SourceTable } from "./sources/types";

/** A parsed row, keyed by header. */
export type SourceRow = Record<string, string>;

export type ImportTable = {
  label: string;
  headers: string[];
  rows: SourceRow[];
  truncated: boolean;
  /**
   * True when the file had no usable header row and we named the columns
   * ourselves. The mapping step says so, because "Column A" is our word, not the
   * user's, and they should know we're guessing entirely from the values.
   */
  headersAreSynthetic: boolean;
  /** Rows above the header that were dropped — a title banner, usually. */
  skippedLeadingRows: number;
  /**
   * Rows *inside* the data that repeated the header, and were dropped.
   *
   * Exports that concatenate per-region sheets, or that repeat the names every
   * page, leave these scattered through the file. Imported rather than dropped,
   * each one becomes a location called "Business Name" at no coordinates —
   * reported rather than silently removed, because a large count means the file
   * is really several files and the user should know.
   */
  repeatedHeaderRows: number;
};

/**
 * What to treat as the header, when someone other than the detector decides.
 *
 * A number is a row index; "none" means the file has no header row and the
 * columns should be named for the user. `undefined` leaves it to detection —
 * which is a heuristic, so the user needs a way to overrule it.
 */
export type HeaderRowChoice = number | "none";

/**
 * Grid → headers and rows.
 *
 * This is where a rectangle of strings becomes something the rest of the import
 * can name its columns by. It owns three jobs that used to belong to PapaParse's
 * `header: true` mode, and had to be taken over when parsing moved to raw cells
 * so the header row's *position* could be detected rather than assumed.
 */
export function buildTable(
  source: SourceTable,
  override?: HeaderRowChoice,
): ImportTable {
  const cells = source.cells;

  if (cells.length === 0) {
    throw new ImportSourceError(
      "That file has no rows in it. Add your locations and try again.",
    );
  }

  const detected =
    override === "none"
      ? null
      : typeof override === "number"
        ? override
        : (source.headerRowIndex ?? detectHeaderRow(cells).headerRowIndex);

  // No detectable header means the first row is data. Naming the columns
  // ourselves keeps the file importable — detection then leans entirely on what
  // the columns contain.
  const headersAreSynthetic = detected === null;
  const headerRowIndex = detected ?? 0;

  const width = cells.reduce((widest, row) => Math.max(widest, row.length), 0);

  if (width === 0) {
    throw new ImportSourceError(
      "That file has no columns in it. Add a row per location and try again.",
    );
  }

  const headers = headersAreSynthetic
    ? Array.from({ length: width }, (_, index) => columnName(index))
    : nameColumns(cells[headerRowIndex] ?? [], width);

  const dataRows = cells.slice(headersAreSynthetic ? 0 : headerRowIndex + 1);
  const headerSignature = headersAreSynthetic
    ? null
    : signature(cells[headerRowIndex] ?? [], width);

  const rows: SourceRow[] = [];
  let repeatedHeaderRows = 0;

  for (const cellRow of dataRows) {
    if (rows.length >= MAX_SOURCE_ROWS) break;

    if (headerSignature !== null && signature(cellRow, width) === headerSignature) {
      repeatedHeaderRows += 1;
      continue;
    }

    const row: SourceRow = {};
    for (const [index, header] of headers.entries()) {
      row[header] = (cellRow[index] ?? "").trim();
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    throw new ImportSourceError(
      "That file has column names but no rows under them. Add your locations and try again.",
    );
  }

  return {
    label: source.label,
    headers,
    rows,
    truncated: source.truncated || dataRows.length > MAX_SOURCE_ROWS,
    headersAreSynthetic,
    skippedLeadingRows: headersAreSynthetic ? 0 : headerRowIndex,
    repeatedHeaderRows,
  };
}

/**
 * A row reduced to what makes it "the same row" as another.
 *
 * Case and surrounding space are ignored because the repeat is usually retyped
 * or re-exported rather than copied, and comparing the raw cells would miss
 * "BUSINESS NAME" under "Business Name". The width is fixed so a repeat with
 * trailing empty cells still matches.
 */
function signature(cells: string[], width: number): string {
  const parts: string[] = [];

  for (let index = 0; index < width; index += 1) {
    parts.push((cells[index] ?? "").trim().toLowerCase());
  }

  // A separator no spreadsheet cell can contain, so ["a b", "c"] and
  // ["a", "b c"] stay distinguishable.
  return parts.join("\u0000");
}

/**
 * Trims, names the blanks, and de-duplicates.
 *
 * Duplicate column names are normal — an export with two "Name" columns is not
 * malformed, it's Tuesday — and a plain object keyed by header would keep only
 * the last one. Suffixing makes the second column addressable instead of lost.
 * PapaParse did this for us under `header: true`; it's ours now.
 */
function nameColumns(headerCells: string[], width: number): string[] {
  const headers: string[] = [];
  const taken = new Set<string>();

  for (let index = 0; index < width; index += 1) {
    const raw = (headerCells[index] ?? "").trim();
    const name = uniqueName(raw || columnName(index), taken);

    taken.add(name);
    headers.push(name);
  }

  return headers;
}

/**
 * `base`, or `base (2)`, or whatever the first free suffix is.
 *
 * Split out of `nameColumns` because the mapping step now creates columns of its
 * own — splitting a combined coordinate column into Latitude and Longitude — and
 * a second de-duplication rule written beside this one would eventually disagree
 * with it about what "Latitude" becomes when the file already has one.
 */
export function uniqueName(base: string, taken: ReadonlySet<string>): string {
  let name = base;

  for (let suffix = 2; taken.has(name); suffix += 1) {
    name = `${base} (${suffix})`;
  }

  return name;
}

/** Spreadsheet-style column names, so "Column B" means what the user's app shows. */
export function columnName(index: number): string {
  let label = "";
  let remaining = index;

  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);

  return `Column ${label}`;
}
