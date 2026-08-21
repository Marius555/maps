import { strFromU8, unzipSync } from "fflate";

import { MAX_SOURCE_BYTES, MAX_SOURCE_ROWS, formatMb } from "../limits";
import { formatSerialDate, isDateFormat } from "./xlsx-dates";
import {
  childrenNamed,
  descendantsNamed,
  firstNamed,
  parseXmlDocument,
} from "./xml-document";
import { ImportSourceError, type SourceTable } from "./types";

/**
 * XLSX → grid, without a spreadsheet library.
 *
 * An .xlsx is a ZIP of XML, we already unzip (fflate arrives with pmtiles) and
 * we already parse XML (the browser's own DOMParser, for the XML source). The
 * alternative was a dependency that either carries unpatched advisories or has
 * to be installed from a vendor CDN — see CLAUDE.md §3 on asking before adding.
 *
 * Reads .xlsx only. A legacy .xls is a completely different binary format and
 * gets told so.
 */

export async function readXlsxFile(
  file: File,
  sheetName?: string,
): Promise<SourceTable> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImportSourceError(
      `That file is ${formatMb(file.size)}. Split it into files under ${formatMb(MAX_SOURCE_BYTES)} and import them one at a time.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (isLegacyXls(bytes)) {
    throw new ImportSourceError(
      "That's an older .xls file. Open it in Excel and save it as .xlsx or CSV, then try again.",
    );
  }

  const zip = unzip(bytes);
  const workbook = readWorkbook(zip);

  const chosen = sheetName
    ? workbook.sheets.find((sheet) => sheet.name === sheetName)
    : workbook.sheets[0];

  if (!chosen) {
    throw new ImportSourceError(
      sheetName
        ? `That workbook has no sheet called "${sheetName}".`
        : "That workbook has no sheets in it.",
    );
  }

  const sheetXml = zip[chosen.path];
  if (!sheetXml) {
    throw new ImportSourceError(
      `We couldn't read the sheet "${chosen.name}". Save the file again from Excel and try once more.`,
    );
  }

  const { cells, truncated } = readSheet(
    strFromU8(sheetXml),
    chosen.name,
    workbook.sharedStrings,
    workbook.dateStyles,
    workbook.epoch1904,
  );

  if (cells.length === 0) {
    throw new ImportSourceError(
      `The sheet "${chosen.name}" is empty. Add a row per location, or pick another sheet.`,
    );
  }

  return {
    label:
      workbook.sheets.length > 1 ? `${file.name} — ${chosen.name}` : file.name,
    cells,
    headerRowIndex: null,
    truncated,
    sheetNames: workbook.sheets.map((sheet) => sheet.name),
  };
}

/** The sheet names alone, so the picker can be shown before a sheet is chosen. */
export async function readXlsxSheetNames(file: File): Promise<string[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return readWorkbook(unzip(bytes)).sheets.map((sheet) => sheet.name);
}

type Zip = Record<string, Uint8Array>;

type Workbook = {
  sheets: { name: string; path: string }[];
  sharedStrings: string[];
  /** Style indexes whose number format is a date, so serials can be formatted. */
  dateStyles: Set<number>;
  epoch1904: boolean;
};

function unzip(bytes: Uint8Array): Zip {
  try {
    // Only the parts we read. A workbook with thirty sheets shouldn't cost
    // thirty decompressions to open the first one.
    return unzipSync(bytes, {
      filter: (file) =>
        file.name === "xl/workbook.xml" ||
        file.name === "xl/_rels/workbook.xml.rels" ||
        file.name === "xl/sharedStrings.xml" ||
        file.name === "xl/styles.xml" ||
        file.name.startsWith("xl/worksheets/"),
    });
  } catch {
    throw new ImportSourceError(
      "We couldn't open that file. Make sure it's a .xlsx saved from Excel, Numbers or Google Sheets.",
    );
  }
}

function readWorkbook(zip: Zip): Workbook {
  const workbookXml = zip["xl/workbook.xml"];
  if (!workbookXml) {
    throw new ImportSourceError(
      "That doesn't look like a spreadsheet. Export your locations as .xlsx or CSV and try again.",
    );
  }

  const doc = parseXmlDocument(strFromU8(workbookXml), "that workbook");
  const relationships = readRelationships(zip);

  const sheets: Workbook["sheets"] = [];
  const sheetsEl = firstNamed(doc.documentElement, "sheets");

  for (const sheet of sheetsEl ? childrenNamed(sheetsEl, "sheet") : []) {
    const name = sheet.getAttribute("name")?.trim();
    if (!name) continue;

    // r:id is namespaced and the prefix isn't guaranteed, so match by local name.
    const relId =
      sheet.getAttribute("r:id") ??
      sheet.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id",
      );

    const target = relId ? relationships.get(relId) : undefined;
    const path = target
      ? normalizePath(target)
      : `xl/worksheets/sheet${sheets.length + 1}.xml`;

    if (zip[path]) sheets.push({ name, path });
  }

  // Some producers omit the rels file entirely; fall back to whatever sheets
  // are physically present rather than reporting an empty workbook.
  if (sheets.length === 0) {
    for (const path of Object.keys(zip).sort()) {
      if (path.startsWith("xl/worksheets/") && path.endsWith(".xml")) {
        sheets.push({ name: `Sheet ${sheets.length + 1}`, path });
      }
    }
  }

  const properties = firstNamed(doc.documentElement, "workbookPr");

  return {
    sheets,
    sharedStrings: readSharedStrings(zip),
    dateStyles: readDateStyles(zip),
    epoch1904: properties?.getAttribute("date1904") === "1",
  };
}

function readRelationships(zip: Zip): Map<string, string> {
  const map = new Map<string, string>();
  const xml = zip["xl/_rels/workbook.xml.rels"];
  if (!xml) return map;

  const doc = parseXmlDocument(strFromU8(xml), "that workbook");

  for (const rel of descendantsNamed(doc.documentElement, "Relationship")) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) map.set(id, target);
  }

  return map;
}

/**
 * The workbook's string pool.
 *
 * Every text cell is an index into this rather than the text itself, which is
 * why a sheet's XML looks like a grid of integers.
 */
function readSharedStrings(zip: Zip): string[] {
  const xml = zip["xl/sharedStrings.xml"];
  if (!xml) return [];

  const doc = parseXmlDocument(strFromU8(xml), "that workbook");
  const strings: string[] = [];

  for (const si of childrenNamed(doc.documentElement, "si")) {
    // A styled string is split across <r> runs; concatenating every <t> puts it
    // back together. Ignoring runs would truncate at the first bold word.
    strings.push(
      descendantsNamed(si, "t")
        .map((node) => node.textContent ?? "")
        .join(""),
    );
  }

  return strings;
}

/**
 * Which style indexes mean "this number is a date".
 *
 * A date in a spreadsheet is a number with a format attached; without this, an
 * opening date imports as "45658" and the column looks like nonsense.
 */
function readDateStyles(zip: Zip): Set<number> {
  const dateStyles = new Set<number>();
  const xml = zip["xl/styles.xml"];
  if (!xml) return dateStyles;

  const doc = parseXmlDocument(strFromU8(xml), "that workbook");

  const customFormats = new Map<number, string>();
  for (const numFmt of descendantsNamed(doc.documentElement, "numFmt")) {
    const id = Number(numFmt.getAttribute("numFmtId"));
    const code = numFmt.getAttribute("formatCode");
    if (Number.isInteger(id) && code) customFormats.set(id, code);
  }

  const cellXfs = firstNamed(doc.documentElement, "cellXfs");
  if (!cellXfs) return dateStyles;

  for (const [index, xf] of childrenNamed(cellXfs, "xf").entries()) {
    const id = Number(xf.getAttribute("numFmtId") ?? "0");
    if (!Number.isInteger(id)) continue;

    if (isDateFormat(id, customFormats.get(id))) dateStyles.add(index);
  }

  return dateStyles;
}

function readSheet(
  xml: string,
  sheetName: string,
  sharedStrings: string[],
  dateStyles: Set<number>,
  epoch1904: boolean,
): { cells: string[][]; truncated: boolean } {
  const doc = parseXmlDocument(xml, `the sheet "${sheetName}"`);
  const sheetData = firstNamed(doc.documentElement, "sheetData");
  if (!sheetData) return { cells: [], truncated: false };

  const cells: string[][] = [];
  let truncated = false;

  for (const rowEl of childrenNamed(sheetData, "row")) {
    if (cells.length > MAX_SOURCE_ROWS) {
      truncated = true;
      break;
    }

    const row: string[] = [];

    for (const cellEl of childrenNamed(rowEl, "c")) {
      // Sparse rows are the norm: an empty cell is simply absent, and its
      // position is carried by the reference. Ignoring `r` shifts every value
      // in the row left by however many blanks preceded it.
      const index = columnIndex(cellEl.getAttribute("r"));
      const at = index ?? row.length;

      while (row.length < at) row.push("");
      row[at] = readCell(cellEl, sharedStrings, dateStyles, epoch1904);
    }

    // Blank rows above or between the data are meaningful to header detection,
    // so they're kept as empty rows rather than dropped here.
    const rowIndex = Number(rowEl.getAttribute("r") ?? "") - 1;
    const at = Number.isInteger(rowIndex) && rowIndex >= 0 ? rowIndex : cells.length;

    while (cells.length < at) cells.push([]);
    cells[at] = row;
  }

  // Trailing blank rows carry no information and would only dilute detection.
  while (cells.length > 0 && cells[cells.length - 1].every((value) => !value)) {
    cells.pop();
  }

  return { cells, truncated };
}

function readCell(
  cell: Element,
  sharedStrings: string[],
  dateStyles: Set<number>,
  epoch1904: boolean,
): string {
  const type = cell.getAttribute("t") ?? "n";

  if (type === "inlineStr") {
    const is = firstNamed(cell, "is");
    if (!is) return "";
    return descendantsNamed(is, "t")
      .map((node) => node.textContent ?? "")
      .join("");
  }

  const value = firstNamed(cell, "v")?.textContent ?? "";
  if (!value) return "";

  if (type === "s") {
    const index = Number(value);
    return sharedStrings[index] ?? "";
  }

  if (type === "str") return value;
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  // An error cell (#N/A, #REF!) has no importable value; blank is honest.
  if (type === "e") return "";

  const styleIndex = Number(cell.getAttribute("s") ?? "");
  if (Number.isInteger(styleIndex) && dateStyles.has(styleIndex)) {
    const formatted = formatSerialDate(Number(value), epoch1904);
    if (formatted) return formatted;
  }

  return value;
}

/** "AB12" → 27. Null for a missing or malformed reference. */
function columnIndex(reference: string | null): number | null {
  if (!reference) return null;

  const letters = /^([A-Z]+)/.exec(reference.toUpperCase())?.[1];
  if (!letters) return null;

  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }

  return index - 1;
}

function normalizePath(target: string): string {
  const cleaned = target.replace(/^\/+/, "").replace(/^xl\//, "");
  return `xl/${cleaned.replace(/^\.\.\//, "")}`;
}

/** The OLE2 compound-document signature every .xls starts with. */
function isLegacyXls(bytes: Uint8Array): boolean {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return signature.every((byte, index) => bytes[index] === byte);
}
