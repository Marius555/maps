import { describe, expect, it } from "vitest";

import {
  buildDraftPlaces,
  draftsNeedingGeocode,
  draftsNeedingReview,
  importableDrafts,
  parseCoordinate,
} from "./draft-places";

const mapping = {
  name: "Name",
  address: "Street",
  city: "City",
  postcode: "Zip",
  country: "Country",
} as const;

describe("buildDraftPlaces", () => {
  it("composes the address from every mapped part, in order", () => {
    const { drafts } = buildDraftPlaces(
      [
        {
          Name: "Corner Shop",
          Street: "Gedimino pr. 9",
          City: "Vilnius",
          Zip: "01103",
          Country: "Lithuania",
        },
      ],
      mapping,
    );

    expect(drafts[0].address).toBe(
      "Gedimino pr. 9, Vilnius, 01103, Lithuania",
    );
  });

  it("does not repeat an address part the full address already contains", () => {
    const { drafts } = buildDraftPlaces(
      [{ Name: "Shop", Street: "Vilnius", City: "Vilnius" }],
      mapping,
    );

    expect(drafts[0].address).toBe("Vilnius");
  });

  it("trims cell values", () => {
    const { drafts } = buildDraftPlaces(
      [{ Name: "  Shop  ", Street: "  Main St  " }],
      mapping,
    );

    expect(drafts[0].name).toBe("Shop");
    expect(drafts[0].address).toBe("Main St");
  });

  it("numbers rows the way a spreadsheet does", () => {
    const { drafts } = buildDraftPlaces(
      [
        { Name: "A", Street: "x" },
        { Name: "B", Street: "y" },
      ],
      mapping,
    );

    expect(drafts.map((draft) => draft.rowNumber)).toEqual([1, 2]);
  });

  it("skips blank rows and reports how many", () => {
    const result = buildDraftPlaces(
      [
        { Name: "A", Street: "x" },
        { Name: "", Street: "" },
        { Name: "   ", Street: "  " },
      ],
      mapping,
    );

    expect(result.drafts).toHaveLength(1);
    expect(result.skippedBlankRows).toBe(2);
  });

  it("flags a row with no name instead of importing it unnamed", () => {
    const { drafts } = buildDraftPlaces([{ Name: "", Street: "Main St" }], mapping);

    expect(drafts[0].problem).toContain("no name");
  });

  it("flags a row with neither an address nor coordinates", () => {
    const { drafts } = buildDraftPlaces([{ Name: "Shop", Street: "" }], mapping);

    expect(drafts[0].problem).toContain("no address");
  });

  it("marks coordinates from the file as manual so geocoding won't overwrite them", () => {
    const { drafts } = buildDraftPlaces(
      [{ Name: "Shop", Lat: "54.687", Lng: "25.28" }],
      { name: "Name", lat: "Lat", lng: "Lng" },
    );

    expect(drafts[0].status).toBe("manual");
    expect(drafts[0].lat).toBe(54.687);
    expect(drafts[0].lng).toBe(25.28);
  });

  it("marks address-only rows as pending", () => {
    const { drafts } = buildDraftPlaces([{ Name: "Shop", Street: "Main St" }], mapping);

    expect(drafts[0].status).toBe("pending");
    expect(drafts[0].lat).toBeNull();
  });

  it("ignores out-of-range coordinates rather than placing a pin at sea", () => {
    const { drafts } = buildDraftPlaces(
      [{ Name: "Shop", Street: "Main St", Lat: "999", Lng: "25.28" }],
      { ...mapping, lat: "Lat", lng: "Lng" },
    );

    expect(drafts[0].status).toBe("pending");
    expect(drafts[0].lat).toBeNull();
  });

  it("leaves unmapped optional fields empty", () => {
    const { drafts } = buildDraftPlaces([{ Name: "Shop", Street: "Main St" }], mapping);

    expect(drafts[0].phone).toBe("");
    expect(drafts[0].categoryLabel).toBe("");
  });
});

describe("parseCoordinate", () => {
  it("reads a plain decimal", () => {
    expect(parseCoordinate("54.687")).toBe(54.687);
    expect(parseCoordinate("-25.28")).toBe(-25.28);
  });

  it("reads a decimal comma, as European spreadsheets export it", () => {
    // Reading "54,687" as 54 would put the location in a different country.
    expect(parseCoordinate("54,687")).toBe(54.687);
  });

  it("returns null for blanks and non-numbers", () => {
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("   ")).toBeNull();
    expect(parseCoordinate("n/a")).toBeNull();
  });
});

describe("draft partitioning", () => {
  const { drafts } = buildDraftPlaces(
    [
      { Name: "Needs geocode", Street: "Main St" },
      { Name: "Has coords", Street: "", Lat: "54.687", Lng: "25.28" },
      { Name: "", Street: "Main St" },
    ],
    { ...mapping, lat: "Lat", lng: "Lng" },
  );

  it("queues only rows that have an address and no coordinates", () => {
    expect(draftsNeedingGeocode(drafts).map((draft) => draft.name)).toEqual([
      "Needs geocode",
    ]);
  });

  it("flags unplaced and broken rows for review", () => {
    const names = draftsNeedingReview(drafts).map((draft) => draft.rowNumber);

    expect(names).toContain(1);
    expect(names).toContain(3);
    expect(names).not.toContain(2);
  });

  it("only lets placed, problem-free rows through to import", () => {
    expect(importableDrafts(drafts).map((draft) => draft.name)).toEqual([
      "Has coords",
    ]);
  });
});
