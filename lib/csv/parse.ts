import Papa from "papaparse";

import type { CsvRow } from "./draft-places";

/**
 * Parsing happens in the browser, not on the server.
 *
 * The file only reaches us once the user has confirmed the review step, so a
 * mis-mapped column costs nothing but a re-pick, and we never store a copy of a
 * customer's spreadsheet.
 */

/** Comfortably past a 3,000-row export; a bigger file is a different problem. */
export const MAX_CSV_BYTES = 5 * 1024 * 1024;

/** The Pro plan's ceiling. Anything beyond this could never be imported anyway. */
export const MAX_CSV_ROWS = 3000;

export type ParsedCsv = {
  headers: string[];
  rows: CsvRow[];
  /** True when the file was longer than MAX_CSV_ROWS and we stopped early. */
  truncated: boolean;
};

export class CsvParseError extends Error {}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  if (file.size > MAX_CSV_BYTES) {
    throw new CsvParseError(
      `That file is ${formatMb(file.size)}. Split it into files under ${formatMb(MAX_CSV_BYTES)} and import them one at a time.`,
    );
  }

  const result = await new Promise<Papa.ParseResult<CsvRow>>((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      // Let the browser detect the delimiter: semicolons are normal in exports
      // from spreadsheets set to a European locale.
      complete: resolve,
      error: (error: Error) =>
        reject(new CsvParseError(`We couldn't read that file: ${error.message}`)),
    });
  });

  const headers = (result.meta.fields ?? [])
    .map((header) => header.trim())
    .filter(Boolean);

  if (headers.length === 0) {
    throw new CsvParseError(
      "That file has no column headers. Add a header row naming each column, then try again.",
    );
  }

  // Papa reports recoverable problems per row. A file that produced no usable
  // rows at all is worth failing on; individual bad rows are surfaced later, in
  // the review step, where they can be fixed one by one.
  if (result.data.length === 0) {
    throw new CsvParseError(
      firstFatalMessage(result.errors) ??
        "That file has headers but no rows. Add your locations and try again.",
    );
  }

  return {
    headers,
    rows: result.data.slice(0, MAX_CSV_ROWS),
    truncated: result.data.length > MAX_CSV_ROWS,
  };
}

function firstFatalMessage(errors: Papa.ParseError[]): string | null {
  const error = errors[0];
  if (!error) return null;

  return `We couldn't read row ${(error.row ?? 0) + 1}: ${error.message}`;
}

function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
}
