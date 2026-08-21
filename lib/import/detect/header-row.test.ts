import { describe, expect, it } from "vitest";

import { detectHeaderRow } from "./header-row";

describe("detectHeaderRow", () => {
  it("finds a header on the first row", () => {
    const cells = [
      ["Name", "Latitude", "Longitude"],
      ["Berlin", "52.5200", "13.4050"],
      ["Hamburg", "53.5511", "9.9937"],
      ["Köln", "50.9375", "6.9603"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(0);
  });

  it("skips a title banner above the header", () => {
    // The shape a spreadsheet actually arrives in: a merged title, a blank
    // spacer, then the real column names.
    const cells = [
      ["Our stockists — March 2026", "", ""],
      ["", "", ""],
      ["Name", "Latitude", "Longitude"],
      ["Berlin", "52.5200", "13.4050"],
      ["Hamburg", "53.5511", "9.9937"],
      ["Köln", "50.9375", "6.9603"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(2);
  });

  it("skips an export timestamp row", () => {
    const cells = [
      ["Exported 2026-03-01", "", ""],
      ["Name", "Latitude", "Longitude"],
      ["Berlin", "52.5200", "13.4050"],
      ["Hamburg", "53.5511", "9.9937"],
      ["Köln", "50.9375", "6.9603"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(1);
  });

  it("reports no header when the first row is already data", () => {
    // Every row is the same shape, so nothing here describes anything else —
    // naming the columns after the first location would be worse than admitting
    // we don't know.
    const cells = [
      ["Berlin", "52.5200", "13.4050"],
      ["Hamburg", "53.5511", "9.9937"],
      ["Köln", "50.9375", "6.9603"],
      ["München", "48.1351", "11.5820"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBeNull();
  });

  it("ignores a one-cell title row", () => {
    const cells = [
      ["Stockists"],
      ["Name", "Latitude", "Longitude"],
      ["Berlin", "52.5200", "13.4050"],
      ["Hamburg", "53.5511", "9.9937"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(1);
  });

  it("skips a placeholder row above the real column names", () => {
    // The shape an export tool writes when it names the columns before it knows
    // them. Row 0 clears every gate — seven filled, all text, all distinct — so
    // "first plausible row wins" took it, the real header became data row 1, and
    // the import failed with "Row 1 has no address and no coordinates".
    const cells = [
      ["Column1", "Column2", "Column3", "Column4", "Column5"],
      ["Business Name", "Type", "Street_Location", "lat_coord", "long_coord"],
      ["Equinox Gym", "Fitness", "897 Broadway, New York", "40.7388", "-73.9904"],
      ["Blink Fitness", "Fitness", "180 Livingston St", "40.6892", "-73.9873"],
      ["Crunch", "Fitness", "162 W 83rd St", "40.7845", "-73.9772"],
      ["Planet Fitness", "Fitness", "125 E 14th St", "40.7331", "-73.9876"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(1);
  });

  it("keeps a placeholder header when no row below it is better", () => {
    // Same useless names, but they really are the column names. Nothing is
    // gained by demoting them, and demoting them would eat a location.
    const cells = [
      ["Column1", "Column2", "Column3"],
      ["Equinox Gym", "897 Broadway", "40.7388"],
      ["Blink Fitness", "180 Livingston St", "40.6892"],
      ["Crunch", "162 W 83rd St", "40.7845"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(0);
  });

  it("does not eat an all-text first location under placeholder names", () => {
    // Both rows read as names and both leave tidy columns, so coherence and
    // informativeness tie and earliness has to break it. Choosing row 1 here
    // would silently drop the Alpha store.
    const cells = [
      ["Column1", "Column2"],
      ["Alpha", "Berlin"],
      ["Beta", "Hamburg"],
      ["Gamma", "Munich"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(0);
  });

  it("keeps the real header above a units row", () => {
    // The units row is perfectly coherent — every column below it is clean — so
    // coherence alone would pick it. Informativeness is what says otherwise.
    const cells = [
      ["Name", "Latitude", "Longitude"],
      ["text", "deg", "deg"],
      ["Berlin", "52.5200", "13.4050"],
      ["Hamburg", "53.5511", "9.9937"],
      ["Koeln", "50.9375", "6.9603"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(0);
  });

  it("finds a header whose names are in a language we do not stock", () => {
    // No synonym matches "Nazev" or "Sirka", so informativeness is 0 for every
    // candidate and coherence carries the decision on its own.
    const cells = [
      ["Nazev", "Sirka", "Delka"],
      ["Alfa", "50.0755", "14.4378"],
      ["Beta", "49.1951", "16.6068"],
      ["Gama", "49.8209", "18.2625"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(0);
  });

  it("does not take a data row whose values happen to end in field names", () => {
    // From a real customer file. "Mystery Shop" ends with the `name` synonym
    // "shop" and "invalid_geo" ends with the `latlng` synonym "geo", so this row
    // used to out-score the real header three rows above it — which threw away
    // every row before it and named all five columns after one location.
    const cells = [
      ["Column1", "Column2", "Column3", "Column4", "Column5"],
      ["col_1", "cat", "where_is_it", "GPS", "details"],
      [
        "Central Park Cafe",
        "Cafe",
        "Central Park, Near Bethesda Fountain",
        "",
        "Phone: 212-555-9999",
      ],
      ["Joe's Pizza", "", "7 Wall St", "40.7075, -74.0089", "Closed Mondays"],
      [
        "Mystery Shop",
        "Retail",
        "USA",
        "invalid_geo",
        "No street address provided",
      ],
      ["Guggenheim Museum", "Museum", "1071 5th Ave", "", "Geocode fallback"],
      [
        "Old Tavern, LLC",
        "Bar",
        "123 Main St, Springfield",
        "40.7128 -74.0060",
        "Missing comma",
      ],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(1);
  });

  it("does not let a thin sample near the end of a file flatter a candidate", () => {
    // Two rows under a candidate make every column trivially homogeneous, so
    // coherence alone scored a late row a perfect 1.0 — the same as the real
    // header with the whole file beneath it.
    const cells = [
      ["Name", "Latitude", "Longitude"],
      ["Berlin", "52.5200", "13.4050"],
      ["Hamburg", "53.5511", "9.9937"],
      ["Munich", "48.1351", "11.5820"],
      ["Koeln", "50.9375", "6.9603"],
      ["Bonn", "50.7374", "7.0982"],
    ];

    expect(detectHeaderRow(cells).headerRowIndex).toBe(0);
  });

  it("handles a file with nothing under the header", () => {
    expect(detectHeaderRow([["Name", "Latitude"]]).headerRowIndex).toBeNull();
  });

  it("handles an empty grid", () => {
    expect(detectHeaderRow([]).headerRowIndex).toBeNull();
  });
});
