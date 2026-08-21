import { describe, expect, it } from "vitest";

import type { SourceRow } from "../table";
import { detectColumns } from "./score";

/** Builds rows from a header list and a matching list of column values. */
function table(columns: Record<string, string[]>): {
  headers: string[];
  rows: SourceRow[];
} {
  const headers = Object.keys(columns);
  const length = Math.max(...headers.map((header) => columns[header].length));

  const rows: SourceRow[] = [];
  for (let index = 0; index < length; index += 1) {
    const row: SourceRow = {};
    for (const header of headers) row[header] = columns[header][index] ?? "";
    rows.push(row);
  }

  return { headers, rows };
}

describe("detectColumns — headers", () => {
  it("maps a tidy header row", () => {
    const { headers, rows } = table({
      Name: ["Berlin Mitte", "Hamburg Hafen", "Köln Süd"],
      Address: ["Torstr. 1", "Hafenweg 9", "Domplatz 4"],
      City: ["Berlin", "Hamburg", "Köln"],
      Postcode: ["10119", "20457", "50667"],
      Country: ["Germany", "Germany", "Germany"],
      Category: ["Flagship", "Outlet", "Flagship"],
      Phone: ["+49 30 1234567", "+49 40 7654321", "+49 221 998877"],
      Email: ["a@example.com", "b@example.com", "c@example.com"],
      Website: ["example.com/a", "example.com/b", "example.com/c"],
    });

    expect(detectColumns(headers, rows).mapping).toMatchObject({
      name: "Name",
      address: "Address",
      city: "City",
      postcode: "Postcode",
      country: "Country",
      category: "Category",
      phone: "Phone",
      email: "Email",
      url: "Website",
    });
  });

  it("ignores case, spaces and punctuation", () => {
    const { headers, rows } = table({
      "Store Name": ["Alpha", "Beta", "Gamma"],
      STREET_ADDRESS: ["1 High St", "2 Low Rd", "3 Mid Ln"],
      "Zip Code": ["10119", "20457", "50667"],
    });

    const { mapping } = detectColumns(headers, rows);

    expect(mapping.name).toBe("Store Name");
    expect(mapping.address).toBe("STREET_ADDRESS");
    expect(mapping.postcode).toBe("Zip Code");
  });

  it("prefers an exact match over a partial one", () => {
    // "Email Address" ends with "address", so a naive matcher puts it in the
    // address field and the real address column loses.
    const { headers, rows } = table({
      Name: ["Alpha", "Beta", "Gamma"],
      Address: ["1 High St", "2 Low Rd", "3 Mid Ln"],
      "Email Address": ["a@example.com", "b@example.com", "c@example.com"],
    });

    const { mapping } = detectColumns(headers, rows);

    expect(mapping.address).toBe("Address");
    expect(mapping.email).toBe("Email Address");
  });

  it("never assigns one column to two fields", () => {
    const { headers, rows } = table({
      Location: ["Alpha", "Beta", "Gamma"],
      "Location (2)": ["Delta", "Epsilon", "Zeta"],
    });

    const used = Object.values(detectColumns(headers, rows).mapping);

    expect(new Set(used).size).toBe(used.length);
  });

  it("recognises coordinate columns under several spellings", () => {
    const short = table({
      lat: ["52.5200", "53.5511", "50.9375"],
      lon: ["13.4050", "9.9937", "6.9603"],
    });
    expect(detectColumns(short.headers, short.rows).mapping).toMatchObject({
      lat: "lat",
      lng: "lon",
    });

    const long = table({
      Latitude: ["52.5200", "53.5511", "50.9375"],
      Longitude: ["13.4050", "9.9937", "6.9603"],
    });
    expect(detectColumns(long.headers, long.rows).mapping).toMatchObject({
      lat: "Latitude",
      lng: "Longitude",
    });
  });

  it("reads German headers", () => {
    const { headers, rows } = table({
      Bezeichnung: ["Alpha", "Beta", "Gamma"],
      Straße: ["Torstr. 1", "Hafenweg 9", "Domplatz 4"],
      PLZ: ["10119", "20457", "50667"],
      Stadt: ["Berlin", "Hamburg", "Köln"],
      Telefonnummer: ["+49 30 1234567", "+49 40 765432", "+49 221 998877"],
    });

    const { mapping } = detectColumns(headers, rows);

    // "Straße" only reaches the "strasse" synonym because normalisation folds
    // the diacritic and expands ß.
    expect(mapping.address).toBe("Straße");
    expect(mapping.postcode).toBe("PLZ");
    expect(mapping.city).toBe("Stadt");
    expect(mapping.phone).toBe("Telefonnummer");
  });

  it("leaves columns it cannot place unmapped", () => {
    const { headers, rows } = table({
      Name: ["Alpha", "Beta", "Gamma"],
      "Internal Ref": ["X-1", "X-2", "X-3"],
    });

    const used = Object.values(detectColumns(headers, rows).mapping);

    expect(used).toContain("Name");
    expect(used).not.toContain("Internal Ref");
  });

  it("never maps an empty column", () => {
    // Matching on the name alone would fill the field with blanks that look
    // mapped and import as nothing.
    const { headers, rows } = table({
      Name: ["Alpha", "Beta", "Gamma"],
      Latitude: ["", "", ""],
    });

    expect(detectColumns(headers, rows).mapping.lat).toBeUndefined();
  });
});

describe("detectColumns — values", () => {
  it("finds coordinates behind meaningless headers", () => {
    const { headers, rows } = table({
      Column1: ["Alpha", "Beta", "Gamma", "Delta"],
      Column2: ["52.5200", "53.5511", "50.9375", "48.1351"],
      Column3: ["113.4050", "109.9937", "106.9603", "111.5820"],
    });

    const { mapping } = detectColumns(headers, rows);

    // Column3 leaves ±90, so it can only be a longitude — and that settles
    // Column2 as the latitude by elimination.
    expect(mapping.lng).toBe("Column3");
    expect(mapping.lat).toBe("Column2");
  });

  it("finds an email column with no useful header", () => {
    const { headers, rows } = table({
      F1: ["Alpha", "Beta", "Gamma"],
      F2: ["a@example.com", "b@example.com", "c@example.com"],
    });

    expect(detectColumns(headers, rows).mapping.email).toBe("F2");
  });

  it("finds a category by how much it repeats", () => {
    const { headers, rows } = table({
      A: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"],
      B: ["Shop", "Shop", "Depot", "Shop", "Depot", "Shop", "Depot", "Shop"],
    });

    // Eight rows, two distinct values: no header check can see this, and it is
    // the single most reliable shape in a locations file.
    expect(detectColumns(headers, rows).mapping.category).toBe("B");
  });

  it("does not call a column of unique values a category", () => {
    const { headers, rows } = table({
      A: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"],
      B: ["r1", "r2", "r3", "r4", "r5", "r6"],
    });

    expect(detectColumns(headers, rows).mapping.category).toBeUndefined();
  });

  it("does not read an id column as a coordinate", () => {
    // Whole numbers in range are far more often a row id than a latitude.
    const { headers, rows } = table({
      id: ["1", "2", "3", "4", "5"],
      Name: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
    });

    expect(detectColumns(headers, rows).mapping.lat).toBeUndefined();
  });

  it("finds a combined coordinate column", () => {
    const { headers, rows } = table({
      Name: ["Alpha", "Beta", "Gamma"],
      Blob: ["52.5200, 13.4050", "53.5511, 9.9937", "50.9375, 6.9603"],
    });

    expect(detectColumns(headers, rows).mapping.latlng).toBe("Blob");
  });
});

describe("detectColumns — confidence", () => {
  it("is confident when the name and the values agree", () => {
    const { headers, rows } = table({
      Latitude: ["52.5200", "53.5511", "50.9375"],
      Longitude: ["113.4050", "109.9937", "106.9603"],
    });

    const { detail } = detectColumns(headers, rows);

    expect(detail.lng?.confidence).toBe("confident");
    expect(detail.lng?.reason).toContain("both");
  });

  it("says so when only the values matched", () => {
    const { headers, rows } = table({
      F1: ["Alpha", "Beta", "Gamma"],
      F2: ["a@example.com", "b@example.com", "c@example.com"],
    });

    const { detail } = detectColumns(headers, rows);

    expect(detail.email?.reason).toContain("values");
  });

  it("offers runners-up for a field it placed", () => {
    const { headers, rows } = table({
      Name: ["Alpha", "Beta", "Gamma"],
      "Store Name": ["Alpha shop", "Beta shop", "Gamma shop"],
    });

    const { detail } = detectColumns(headers, rows);

    expect(detail.name?.alternatives).toContain("Store Name");
  });
});

describe("detectColumns — byHeader", () => {
  it("ranks a column's plausible fields best first", () => {
    const { headers, rows } = table({
      Latitude: ["52.5200", "53.5511", "50.9375"],
      Longitude: ["13.4050", "9.9937", "6.9603"],
    });

    const { byHeader } = detectColumns(headers, rows);
    const suggested = byHeader.Latitude ?? [];

    // Whatever else the column could be, the winner is the one the picker puts
    // at the top — this is the ordering the ranked section relies on.
    expect(suggested[0]?.field).toBe("lat");
    expect(suggested.map((entry) => entry.score)).toEqual(
      [...suggested.map((entry) => entry.score)].sort((a, b) => b - a),
    );
  });

  it("keeps the runner-up a column lost to a better one", () => {
    // "Store Name" loses Name to "Name", but it is still the second best Name in
    // the file, and someone correcting a wrong guess is going to want it.
    const { headers, rows } = table({
      Name: ["Alpha", "Beta", "Gamma"],
      "Store Name": ["Alpha shop", "Beta shop", "Gamma shop"],
    });

    const { mapping, byHeader } = detectColumns(headers, rows);

    expect(mapping.name).toBe("Name");
    expect(byHeader["Store Name"]?.map((entry) => entry.field)).toContain(
      "name",
    );
  });

  it("carries a confidence and a reason for each suggestion", () => {
    const { headers, rows } = table({
      Latitude: ["52.5200", "53.5511", "50.9375"],
      Longitude: ["13.4050", "9.9937", "6.9603"],
    });

    const { byHeader } = detectColumns(headers, rows);
    const best = byHeader.Longitude?.[0];

    expect(best?.field).toBe("lng");
    expect(best?.confidence).toBe("confident");
    expect(best?.reason).toContain("both");
  });

  it("leaves out a column nothing matched", () => {
    const { headers, rows } = table({
      Name: ["Alpha", "Beta", "Gamma"],
      Notes: ["", "", ""],
    });

    // An empty column can't feed anything, so it is never a candidate and the
    // picker falls back to the plain canonical list for it.
    expect(detectColumns(headers, rows).byHeader.Notes).toBeUndefined();
  });
});
