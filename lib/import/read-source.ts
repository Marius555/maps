import { detectColumns, type DetectionResult } from "./detect/score";
import { buildTable, type HeaderRowChoice, type ImportTable } from "./table";
import { readCsvFile } from "./sources/csv";
import { readXlsxFile } from "./sources/xlsx";
import { readXmlFile } from "./sources/xml";
import { ImportSourceError, type SourceKind, type SourceTable } from "./sources/types";

export type LoadedSource = ImportTable & {
  kind: SourceKind;
  detection: DetectionResult;
  sheetNames?: string[];
  /**
   * The grid as it was read, kept so the header row can be chosen again.
   *
   * Detection is a heuristic and a wrong guess currently has no escape hatch —
   * the file is simply unimportable and the reason is invisible. Holding the raw
   * cells lets the mapping step re-run the whole build against a different row.
   * It is already bounded: every source slices to MAX_SOURCE_ROWS before this.
   */
  source: SourceTable;
  /** Which row became the column names. null when we named them ourselves. */
  headerRowIndex: number | null;
};

/** What the file picker accepts, and what the drop zone tests a drop against. */
export const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".txt", ".xlsx", ".xml"] as const;

export const FILE_ACCEPT = ACCEPTED_EXTENSIONS.join(",");

/**
 * A file → a table with a detected mapping.
 *
 * The one place a format is chosen. Everything downstream — detection, the
 * mapping step, drafts, geocoding, review — works on the table alone and has no
 * idea whether it came from a spreadsheet, a feed or a Google Sheet.
 */
export async function readFile(
  file: File,
  options?: { sheetName?: string },
): Promise<LoadedSource> {
  const kind = kindOf(file);

  const source =
    kind === "xlsx"
      ? await readXlsxFile(file, options?.sheetName)
      : kind === "xml"
        ? await readXmlFile(file)
        : await readCsvFile(file);

  return finish(source, kind);
}

/** A source table that has already been read (a Google Sheet) → the same shape. */
export function finishSource(source: SourceTable, kind: SourceKind): LoadedSource {
  return finish(source, kind);
}

/** The same source read again, with the header row the user picked. */
export function rebuildSource(
  loaded: LoadedSource,
  choice: HeaderRowChoice,
): LoadedSource {
  return finish(loaded.source, loaded.kind, choice);
}

function finish(
  source: SourceTable,
  kind: SourceKind,
  override?: HeaderRowChoice,
): LoadedSource {
  const table = buildTable(source, override);

  return {
    ...table,
    kind,
    sheetNames: source.sheetNames,
    detection: detectColumns(table.headers, table.rows),
    source,
    // `skippedLeadingRows` *is* the chosen index — everything above the header
    // is what was skipped — so this stays one fact rather than two that can
    // disagree.
    headerRowIndex: table.headersAreSynthetic ? null : table.skippedLeadingRows,
  };
}

function kindOf(file: File): SourceKind {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) return "xlsx";
  if (name.endsWith(".xml") || name.endsWith(".kml")) return "xml";
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return "csv";
  }

  if (name.endsWith(".xls")) {
    throw new ImportSourceError(
      "That's an older .xls file. Open it in Excel and save it as .xlsx or CSV, then try again.",
    );
  }

  if (name.endsWith(".numbers") || name.endsWith(".ods")) {
    throw new ImportSourceError(
      "We can't read that format yet. Export your locations as .xlsx or CSV and try again.",
    );
  }

  throw new ImportSourceError(
    "We can't read that kind of file. Choose a CSV, an Excel .xlsx, or an XML file.",
  );
}
