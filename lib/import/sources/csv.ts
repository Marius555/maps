import Papa from "papaparse";

import { MAX_SOURCE_BYTES, MAX_SOURCE_ROWS, formatMb } from "../limits";
import { ImportSourceError, type SourceTable } from "./types";

/**
 * CSV → grid.
 *
 * Parsed with `header: false`, unlike the original import: the header row's
 * position is detected downstream, and it isn't always row 0. That means we also
 * inherit the naming and de-duplication PapaParse used to do for us — see
 * `table.ts`.
 *
 * Parsing happens in the browser. The file only reaches us once the review step
 * is confirmed, so a wrong pick costs a re-pick and we never store a copy of a
 * customer's spreadsheet.
 */

export async function readCsvFile(file: File): Promise<SourceTable> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImportSourceError(
      `That file is ${formatMb(file.size)}. Split it into files under ${formatMb(MAX_SOURCE_BYTES)} and import them one at a time.`,
    );
  }

  return readCsvText(await decode(file), file.name);
}

export function readCsvText(text: string, label: string): SourceTable {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    // Let Papa detect the delimiter: semicolons are normal in exports from
    // spreadsheets set to a European locale, and tabs from a paste.
  });

  const cells = result.data.filter((row) => Array.isArray(row));

  if (cells.length === 0) {
    throw new ImportSourceError(
      firstFatalMessage(result.errors) ??
        "That file is empty. Add a row per location and try again.",
    );
  }

  return {
    label,
    cells: cells.slice(0, MAX_SOURCE_ROWS + 1),
    headerRowIndex: null,
    truncated: cells.length > MAX_SOURCE_ROWS + 1,
  };
}

/**
 * UTF-8, falling back to windows-1252.
 *
 * Excel's "CSV (Comma delimited)" export writes the system codepage, not UTF-8,
 * so a French or German customer's file arrives with every accent as U+FFFD.
 * Decoding it twice costs nothing on a 5MB ceiling and turns "Ch�teau" back into
 * "Château" — otherwise it imports the mojibake and the name is wrong forever.
 */
async function decode(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);

  if (!utf8.includes("�")) return utf8;

  try {
    return new TextDecoder("windows-1252").decode(buffer);
  } catch {
    // The label is optional in the spec; if this runtime lacks it, mojibake is
    // still better than refusing the file.
    return utf8;
  }
}

function firstFatalMessage(errors: Papa.ParseError[]): string | null {
  const error = errors[0];
  if (!error) return null;

  return `We couldn't read row ${(error.row ?? 0) + 1}: ${error.message}`;
}
