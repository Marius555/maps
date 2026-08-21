/**
 * The one shape every import source produces.
 *
 * CSV and XLSX are positional grids; XML is a bag of named records. They are
 * unified here rather than downstream, so detection, mapping, preview and draft
 * building never learn there was more than one format — the alternative is four
 * near-copies of the same pipeline that drift apart the first time one is fixed.
 */
export type SourceTable = {
  /** What to call this in the UI: a file name, or the sheet's title. */
  label: string;
  /**
   * The raw grid, right-padded to a rectangle. No header interpretation at all:
   * row 0 is whatever was physically first in the file, which for a real
   * spreadsheet is often a title, a blank line, or a merged banner.
   */
  cells: string[][];
  /**
   * Set by record-shaped sources (XML), where the header row is a construct we
   * built rather than a guess. `null` means "detect it" — see detect/header-row.
   */
  headerRowIndex: number | null;
  /** True when the source was longer than MAX_SOURCE_ROWS and we stopped early. */
  truncated: boolean;
  /** Present for a workbook with more than one sheet, so the UI can offer them. */
  sheetNames?: string[];
};

/**
 * A failure the user can act on.
 *
 * The message is user-facing copy, per CLAUDE.md §8 — it says what happened and
 * what to do about it. Anything we can't phrase that way should stay an ordinary
 * Error and get the generic fallback.
 */
export class ImportSourceError extends Error {}

export const SOURCE_KINDS = ["csv", "xlsx", "xml", "google-sheet"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
