/**
 * @vitest-environment jsdom
 *
 * The XLSX reader parses the sheet XML with DOMParser, which Node doesn't have.
 */

import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { buildTable } from "../table";
import { readXlsxFile, readXlsxSheetNames } from "./xlsx";
import { ImportSourceError } from "./types";

/**
 * A workbook, built the way Excel builds one.
 *
 * Writing the parts by hand rather than committing a binary fixture: the point of
 * these tests is the container layout — shared strings, relationship ids, sparse
 * cell references — and a fixture hides exactly the thing under test.
 */
function workbook(options: {
  sheets: { name: string; rows: string }[];
  sharedStrings?: string[];
  styles?: string;
  omitRels?: boolean;
}): File {
  const files: Record<string, Uint8Array> = {};

  const sheetTags = options.sheets
    .map(
      (sheet, index) =>
        `<sheet name="${sheet.name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");

  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`,
  );

  if (!options.omitRels) {
    const rels = options.sheets
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join("");

    files["xl/_rels/workbook.xml.rels"] = strToU8(
      `<?xml version="1.0"?><Relationships>${rels}</Relationships>`,
    );
  }

  for (const [index, sheet] of options.sheets.entries()) {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(
      `<?xml version="1.0"?><worksheet><sheetData>${sheet.rows}</sheetData></worksheet>`,
    );
  }

  if (options.sharedStrings) {
    const items = options.sharedStrings
      .map((value) => `<si><t>${value}</t></si>`)
      .join("");

    files["xl/sharedStrings.xml"] = strToU8(
      `<?xml version="1.0"?><sst>${items}</sst>`,
    );
  }

  if (options.styles) files["xl/styles.xml"] = strToU8(options.styles);

  return new File([zipSync(files) as BlobPart], "test.xlsx");
}

/** An inline-number cell. */
function num(ref: string, value: string, style?: number): string {
  return `<c r="${ref}"${style === undefined ? "" : ` s="${style}"`}><v>${value}</v></c>`;
}

/** A shared-string cell. */
function str(ref: string, index: number): string {
  return `<c r="${ref}" t="s"><v>${index}</v></c>`;
}

describe("readXlsxFile", () => {
  it("reads a sheet through the shared string table", async () => {
    // Text cells are indexes into a workbook-wide pool, which is why a sheet's
    // XML looks like a grid of integers.
    const file = workbook({
      sharedStrings: ["Name", "City", "Alpha", "Berlin", "Beta", "Hamburg"],
      sheets: [
        {
          name: "Locations",
          rows:
            `<row r="1">${str("A1", 0)}${str("B1", 1)}</row>` +
            `<row r="2">${str("A2", 2)}${str("B2", 3)}</row>` +
            `<row r="3">${str("A3", 4)}${str("B3", 5)}</row>`,
        },
      ],
    });

    const table = buildTable(await readXlsxFile(file));

    expect(table.headers).toEqual(["Name", "City"]);
    expect(table.rows).toEqual([
      { Name: "Alpha", City: "Berlin" },
      { Name: "Beta", City: "Hamburg" },
    ]);
  });

  it("keeps a blank cell in its own column", async () => {
    // An empty cell is simply absent and its position is carried by `r`.
    // Ignoring that shifts every later value in the row one column left.
    const file = workbook({
      sharedStrings: ["Name", "City", "Phone", "Alpha", "030 1234567"],
      sheets: [
        {
          name: "Sheet1",
          rows:
            `<row r="1">${str("A1", 0)}${str("B1", 1)}${str("C1", 2)}</row>` +
            `<row r="2">${str("A2", 3)}${str("C2", 4)}</row>`,
        },
      ],
    });

    const table = buildTable(await readXlsxFile(file));

    expect(table.rows[0]).toEqual({
      Name: "Alpha",
      City: "",
      Phone: "030 1234567",
    });
  });

  it("reads inline strings", async () => {
    const file = workbook({
      sheets: [
        {
          name: "Sheet1",
          rows:
            `<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>City</t></is></c></row>` +
            `<row r="2"><c r="A2" t="inlineStr"><is><t>Alpha</t></is></c><c r="B2" t="inlineStr"><is><t>Berlin</t></is></c></row>`,
        },
      ],
    });

    const table = buildTable(await readXlsxFile(file));

    expect(table.rows[0]).toEqual({ Name: "Alpha", City: "Berlin" });
  });

  it("reads numbers as they were written", async () => {
    const file = workbook({
      sharedStrings: ["Name", "Latitude", "Longitude", "Alpha", "Beta", "Gamma"],
      sheets: [
        {
          name: "Sheet1",
          rows:
            `<row r="1">${str("A1", 0)}${str("B1", 1)}${str("C1", 2)}</row>` +
            `<row r="2">${str("A2", 3)}${num("B2", "52.52")}${num("C2", "13.405")}</row>` +
            `<row r="3">${str("A3", 4)}${num("B3", "53.5511")}${num("C3", "9.9937")}</row>` +
            `<row r="4">${str("A4", 5)}${num("B4", "50.9375")}${num("C4", "6.9603")}</row>`,
        },
      ],
    });

    const table = buildTable(await readXlsxFile(file));

    expect(table.rows[0].Latitude).toBe("52.52");
    expect(table.rows[0].Longitude).toBe("13.405");
  });

  it("formats a date instead of importing its serial number", async () => {
    // numFmtId 14 is Excel's built-in short date. Without this the column
    // imports as "45658" and nobody can tell what it was for.
    const file = workbook({
      sharedStrings: ["Name", "Opened", "Alpha", "Beta"],
      styles:
        '<?xml version="1.0"?><styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
      sheets: [
        {
          name: "Sheet1",
          rows:
            `<row r="1">${str("A1", 0)}${str("B1", 1)}</row>` +
            `<row r="2">${str("A2", 2)}${num("B2", "45658", 1)}</row>` +
            `<row r="3">${str("A3", 3)}${num("B3", "45659", 1)}</row>`,
        },
      ],
    });

    const table = buildTable(await readXlsxFile(file));

    expect(table.rows[0].Opened).toBe("2025-01-01");
  });

  it("lists every sheet and reads the one asked for", async () => {
    const file = workbook({
      sharedStrings: ["Name", "Alpha", "Other", "Beta"],
      sheets: [
        {
          name: "Notes",
          rows: `<row r="1">${str("A1", 2)}</row><row r="2">${str("A2", 3)}</row>`,
        },
        {
          name: "Locations",
          rows: `<row r="1">${str("A1", 0)}</row><row r="2">${str("A2", 1)}</row>`,
        },
      ],
    });

    expect(await readXlsxSheetNames(file)).toEqual(["Notes", "Locations"]);

    const chosen = await readXlsxFile(file, "Locations");

    expect(chosen.label).toContain("Locations");
    expect(chosen.cells[1]?.[0]).toBe("Alpha");
  });

  it("falls back to the sheets on disk when the rels file is missing", async () => {
    const file = workbook({
      omitRels: true,
      sharedStrings: ["Name", "Alpha"],
      sheets: [
        {
          name: "Sheet1",
          rows: `<row r="1">${str("A1", 0)}</row><row r="2">${str("A2", 1)}</row>`,
        },
      ],
    });

    expect((await readXlsxFile(file)).cells[1]?.[0]).toBe("Alpha");
  });

  it("tells the user what to do with a legacy .xls", async () => {
    // The OLE2 signature every .xls starts with. It is a completely different
    // binary format, so failing early with an action beats failing at the unzip.
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]);

    await expect(
      readXlsxFile(new File([ole as BlobPart], "old.xls")),
    ).rejects.toThrow(/save it as \.xlsx/);
  });

  it("refuses something that isn't a spreadsheet", async () => {
    await expect(
      readXlsxFile(new File(["not a zip"], "test.xlsx")),
    ).rejects.toThrow(ImportSourceError);
  });
});
