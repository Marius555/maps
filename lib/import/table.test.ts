import { describe, expect, it } from "vitest";

import { buildTable, columnName } from "./table";
import { ImportSourceError, type SourceTable } from "./sources/types";

function source(cells: string[][], overrides?: Partial<SourceTable>): SourceTable {
  return {
    label: "test.csv",
    cells,
    headerRowIndex: null,
    truncated: false,
    ...overrides,
  };
}

describe("buildTable", () => {
  it("keys rows by their header", () => {
    const table = buildTable(
      source([
        ["Name", "City"],
        ["Alpha", "Berlin"],
        ["Beta", "Hamburg"],
      ]),
    );

    expect(table.headers).toEqual(["Name", "City"]);
    expect(table.rows).toEqual([
      { Name: "Alpha", City: "Berlin" },
      { Name: "Beta", City: "Hamburg" },
    ]);
  });

  it("de-duplicates repeated column names", () => {
    // Two "Name" columns is normal, not malformed. A plain object keyed by
    // header would keep only the last one and silently lose the other column.
    const table = buildTable(
      source([
        ["Name", "City", "Name"],
        ["Alpha", "Berlin", "Alpha GmbH"],
      ]),
    );

    expect(table.headers).toEqual(["Name", "City", "Name (2)"]);
    expect(table.rows[0]["Name (2)"]).toBe("Alpha GmbH");
  });

  it("names a blank column after its position", () => {
    const table = buildTable(
      source([
        ["Name", "", "City"],
        ["Alpha", "x", "Berlin"],
      ]),
    );

    expect(table.headers).toEqual(["Name", "Column B", "City"]);
  });

  it("pads a short row instead of dropping its columns", () => {
    const table = buildTable(
      source([
        ["Name", "City", "Phone"],
        ["Alpha", "Berlin"],
      ]),
    );

    expect(table.rows[0]).toEqual({ Name: "Alpha", City: "Berlin", Phone: "" });
  });

  it("trims the cells and the column names", () => {
    const table = buildTable(
      source([
        ["  Name  ", "City"],
        ["  Alpha  ", " Berlin "],
      ]),
    );

    expect(table.headers).toEqual(["Name", "City"]);
    expect(table.rows[0].Name).toBe("Alpha");
    expect(table.rows[0].City).toBe("Berlin");
  });

  it("skips the rows above a detected header and says how many", () => {
    const table = buildTable(
      source([
        ["Our stockists", "", ""],
        ["", "", ""],
        ["Name", "Latitude", "Longitude"],
        ["Alpha", "52.5200", "13.4050"],
        ["Beta", "53.5511", "9.9937"],
        ["Gamma", "50.9375", "6.9603"],
      ]),
    );

    expect(table.headers).toEqual(["Name", "Latitude", "Longitude"]);
    expect(table.skippedLeadingRows).toBe(2);
    expect(table.rows).toHaveLength(3);
  });

  it("names the columns itself when there is no header row", () => {
    const table = buildTable(
      source([
        ["Alpha", "52.5200", "13.4050"],
        ["Beta", "53.5511", "9.9937"],
        ["Gamma", "50.9375", "6.9603"],
        ["Delta", "48.1351", "11.5820"],
      ]),
    );

    expect(table.headersAreSynthetic).toBe(true);
    expect(table.headers).toEqual(["Column A", "Column B", "Column C"]);
    // The first row is data and must survive as data.
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0]["Column A"]).toBe("Alpha");
  });

  it("trusts a header row the source declared", () => {
    // XML builds its own header row, so there is nothing to detect.
    const table = buildTable(
      source(
        [
          ["name", "lat"],
          ["Alpha", "52.52"],
        ],
        { headerRowIndex: 0 },
      ),
    );

    expect(table.headers).toEqual(["name", "lat"]);
    expect(table.headersAreSynthetic).toBe(false);
  });

  it("drops a header row repeated inside the data", () => {
    // Exports that concatenate per-region sheets leave the names scattered
    // through the file. Imported, each one becomes a location called "Name" at
    // no coordinates.
    const table = buildTable(
      source([
        ["Name", "City"],
        ["Alpha", "Berlin"],
        ["NAME", "CITY"],
        ["Beta", "Hamburg"],
      ]),
    );

    expect(table.rows).toEqual([
      { Name: "Alpha", City: "Berlin" },
      { Name: "Beta", City: "Hamburg" },
    ]);
    expect(table.repeatedHeaderRows).toBe(1);
  });

  it("keeps a data row that merely starts like the header", () => {
    // "Name" as an actual shop name is not a repeat of the header row, and
    // dropping it would lose a real location.
    const table = buildTable(
      source([
        ["Name", "City"],
        ["Name", "Berlin"],
        ["Beta", "Hamburg"],
      ]),
    );

    expect(table.rows).toHaveLength(2);
    expect(table.repeatedHeaderRows).toBe(0);
  });

  it("refuses an empty grid", () => {
    expect(() => buildTable(source([]))).toThrow(ImportSourceError);
  });

  it("refuses a header with nothing under it", () => {
    expect(() => buildTable(source([["Name", "City"]], { headerRowIndex: 0 }))).toThrow(
      /no rows under them/,
    );
  });
});

describe("columnName", () => {
  it("uses spreadsheet letters so it matches what the user sees", () => {
    expect(columnName(0)).toBe("Column A");
    expect(columnName(25)).toBe("Column Z");
    expect(columnName(26)).toBe("Column AA");
    expect(columnName(27)).toBe("Column AB");
  });
});
