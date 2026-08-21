import { describe, expect, it } from "vitest";

import { splitLatLngColumn } from "./split-latlng";
import type { SourceRow } from "./table";

function table(values: string[]): { headers: string[]; rows: SourceRow[] } {
  return {
    headers: ["Name", "GPS"],
    rows: values.map((gps, index) => ({ Name: `Shop ${index + 1}`, GPS: gps })),
  };
}

describe("splitLatLngColumn", () => {
  it("splits a decimal pair into two columns in place", () => {
    const { headers, rows } = table(["52.52, 13.405", "54.6872, 25.2797"]);
    const result = splitLatLngColumn(headers, rows, "GPS");

    expect(result).not.toBeNull();
    // In place: the combined column's position is where the two land, so the
    // table doesn't reshuffle under the user.
    expect(result?.headers).toEqual(["Name", "Latitude", "Longitude"]);
    expect(result?.rows[0]).toEqual({
      Name: "Shop 1",
      Latitude: "52.52",
      Longitude: "13.405",
    });
    expect(result?.rows[1].Latitude).toBe("54.6872");
    expect(result?.unparsed).toBe(0);
  });

  it("drops the combined column from every row", () => {
    const { headers, rows } = table(["52.52, 13.405"]);
    const result = splitLatLngColumn(headers, rows, "GPS");

    expect(result?.headers).not.toContain("GPS");
    expect(result?.rows[0]).not.toHaveProperty("GPS");
  });

  it("reads a decimal-comma pair", () => {
    // "54,6872 25,2797" is what a European spreadsheet exports, and splitting it
    // on the comma would produce four numbers rather than two.
    const { headers, rows } = table(["54,6872 25,2797"]);
    const result = splitLatLngColumn(headers, rows, "GPS");

    expect(result?.rows[0].Latitude).toBe("54.6872");
    expect(result?.rows[0].Longitude).toBe("25.2797");
  });

  it("reads a pasted Google Maps link", () => {
    const { headers, rows } = table([
      "https://www.google.com/maps/@54.6872,25.2797,15z",
    ]);
    const result = splitLatLngColumn(headers, rows, "GPS");

    expect(result?.rows[0].Latitude).toBe("54.6872");
    expect(result?.rows[0].Longitude).toBe("25.2797");
  });

  it("leaves an unreadable cell empty and counts it", () => {
    const { headers, rows } = table(["52.52, 13.405", "n/a", ""]);
    const result = splitLatLngColumn(headers, rows, "GPS");

    expect(result?.rows[1].Latitude).toBe("");
    expect(result?.rows[1].Longitude).toBe("");
    // The blank row is not a loss — it was already blank.
    expect(result?.unparsed).toBe(1);
  });

  it("declines when nothing in the column parses", () => {
    // Otherwise the action would delete a column and produce two empty ones.
    const { headers, rows } = table(["n/a", "see website"]);

    expect(splitLatLngColumn(headers, rows, "GPS")).toBeNull();
  });

  it("declines when the column isn't in the table", () => {
    const { headers, rows } = table(["52.52, 13.405"]);

    expect(splitLatLngColumn(headers, rows, "Nope")).toBeNull();
  });

  it("suffixes around a Latitude column that already exists", () => {
    const headers = ["Latitude", "GPS"];
    const rows: SourceRow[] = [{ Latitude: "", GPS: "52.52, 13.405" }];
    const result = splitLatLngColumn(headers, rows, "GPS");

    expect(result?.latHeader).toBe("Latitude (2)");
    expect(result?.lngHeader).toBe("Longitude");
    expect(result?.headers).toEqual(["Latitude", "Latitude (2)", "Longitude"]);
    expect(result?.rows[0]["Latitude (2)"]).toBe("52.52");
  });
});
