/**
 * @vitest-environment jsdom
 *
 * `readCsvFile` takes a File and decodes its bytes, which needs the browser File
 * API. The text-level tests below would run under node; they share a file with
 * the decoding ones so the CSV source is covered in one place.
 */

import { describe, expect, it } from "vitest";

import { buildTable } from "../table";
import { readCsvFile, readCsvText } from "./csv";
import { ImportSourceError } from "./types";

/** CSV text straight through to the table the mapping step sees. */
function table(csv: string) {
  return buildTable(readCsvText(csv, "test.csv"));
}

/** A File holding raw bytes, the way a real upload arrives. */
function bytesFile(bytes: number[], name = "test.csv"): File {
  return new File([new Uint8Array(bytes)], name, { type: "text/csv" });
}

/** windows-1252 encodes each of these as one byte. */
function latin1File(text: string, name = "test.csv"): File {
  return bytesFile([...text].map((char) => char.charCodeAt(0)), name);
}

describe("readCsvText", () => {
  it("reads a comma-delimited file", () => {
    const result = table("Name,City\nAlpha,Berlin\nBeta,Hamburg\n");

    expect(result.headers).toEqual(["Name", "City"]);
    expect(result.rows).toHaveLength(2);
  });

  it("detects a semicolon delimiter", () => {
    // Normal in exports from a spreadsheet set to a European locale.
    const result = table("Name;City;Postcode\nAlpha;Berlin;10119\n");

    expect(result.headers).toEqual(["Name", "City", "Postcode"]);
    expect(result.rows[0].City).toBe("Berlin");
  });

  it("detects a tab delimiter", () => {
    const result = table("Name\tCity\nAlpha\tBerlin\n");

    expect(result.headers).toEqual(["Name", "City"]);
  });

  it("keeps both of two identically named columns", () => {
    const result = table("Name,City,Name\nAlpha,Berlin,Alpha GmbH\n");

    expect(result.headers).toEqual(["Name", "City", "Name (2)"]);
    expect(result.rows[0]["Name (2)"]).toBe("Alpha GmbH");
  });

  it("reads quoted values containing the delimiter", () => {
    const result = table('Name,Address\nAlpha,"Torstr. 1, Berlin"\n');

    expect(result.rows[0].Address).toBe("Torstr. 1, Berlin");
  });

  it("skips blank lines", () => {
    const result = table("Name,City\nAlpha,Berlin\n\n\nBeta,Hamburg\n");

    expect(result.rows).toHaveLength(2);
  });

  it("finds the header under a title row", () => {
    const result = table(
      "Our stockists,,\n,,\nName,Latitude,Longitude\nAlpha,52.52,13.40\nBeta,53.55,9.99\nGamma,50.93,6.96\n",
    );

    expect(result.headers).toEqual(["Name", "Latitude", "Longitude"]);
    // One, not two: Papa's greedy blank-line skipping removes the ",," spacer
    // before the grid reaches us, so the only row left above the header is the
    // title.
    expect(result.skippedLeadingRows).toBe(1);
  });

  it("refuses an empty file", () => {
    expect(() => table("")).toThrow(ImportSourceError);
  });
});

describe("readCsvFile — decoding", () => {
  it("reads UTF-8", async () => {
    const file = new File(["Name,City\nCafé,Orléans\n"], "test.csv");
    const source = await readCsvFile(file);

    expect(source.cells[1]).toEqual(["Café", "Orléans"]);
  });

  it("recovers a windows-1252 file", async () => {
    // Excel's "CSV (Comma delimited)" writes the system codepage, not UTF-8, so a
    // French or German customer's export arrives with every accent as one
    // high byte. Read as UTF-8 those are invalid sequences and become U+FFFD —
    // and "Ch�teau" would be imported, and wrong, forever.
    const file = latin1File("Name,City\nCh\xe2teau,Orl\xe9ans\nCaf\xe9,Besan\xe7on\n");

    const source = await readCsvFile(file);

    expect(source.cells[1]).toEqual(["Château", "Orléans"]);
    expect(source.cells[2]).toEqual(["Café", "Besançon"]);
  });

  it("strips a UTF-8 byte order mark from the first column name", async () => {
    // Excel prefixes its UTF-8 export with a BOM; left in place it becomes part
    // of the first header, and that header then matches no synonym at all.
    const file = bytesFile([
      0xef, 0xbb, 0xbf,
      ...[..."Name,City\nAlpha,Berlin\n"].map((c) => c.charCodeAt(0)),
    ]);

    const source = await readCsvFile(file);

    expect(source.cells[0]).toEqual(["Name", "City"]);
  });

  it("refuses a file past the size ceiling", async () => {
    const huge = new File([new Uint8Array(6 * 1024 * 1024)], "big.csv");

    await expect(readCsvFile(huge)).rejects.toThrow(/Split it into files/);
  });
});
