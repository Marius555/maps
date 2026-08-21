import { describe, expect, it } from "vitest";

import {
  buildDraftPlaces,
  draftsNeedingGeocode,
  draftsNeedingReview,
  importableDrafts,
  parseCoordinate,
  recomputeIssues,
  type DraftPlace,
} from "./draft-places";
import type { RowIssue } from "./issues";

/** The messages, joined, for the field under test. */
function messagesOn(issues: RowIssue[], field: RowIssue["field"]): string {
  return issues
    .filter((issue) => issue.field === field)
    .map((issue) => issue.message)
    .join(" ");
}

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

    expect(messagesOn(drafts[0].issues, "name")).toContain("no name");
  });

  it("flags a row with neither an address nor coordinates", () => {
    const { drafts } = buildDraftPlaces([{ Name: "Shop", Street: "" }], mapping);

    expect(messagesOn(drafts[0].issues, "address")).toContain("no address");
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

  it("says so when a coordinate cell held something it couldn't read", () => {
    // The whole point: this row is still importable via its address, but the
    // value the file supplied was thrown away and the user has to be able to
    // find out which cell that was.
    const { drafts } = buildDraftPlaces(
      [{ Name: "Mystery Shop", Street: "USA", GPS: "invalid_geo" }],
      { ...mapping, latlng: "GPS" },
    );

    const message = messagesOn(drafts[0].issues, "coordinates");
    expect(message).toContain("invalid_geo");
    expect(drafts[0].issues.every((issue) => issue.severity !== "error")).toBe(
      false,
    );
  });

  it("stays quiet about coordinates when the file simply had no such column", () => {
    const { drafts } = buildDraftPlaces([{ Name: "Shop", Street: "Main St" }], mapping);

    expect(messagesOn(drafts[0].issues, "coordinates")).toBe("");
  });

  it("names the row that lost a website, not just the total", () => {
    const { drafts, droppedContacts } = buildDraftPlaces(
      [
        { Name: "Good", Street: "Main St", Web: "example.com" },
        { Name: "Bad", Street: "Main St", Web: "N/A" },
      ],
      { ...mapping, url: "Web" },
    );

    expect(droppedContacts).toBe(1);
    expect(messagesOn(drafts[0].issues, "url")).toBe("");
    expect(messagesOn(drafts[1].issues, "url")).toContain("N/A");
    expect(drafts[1].url).toBe("");
  });

  it("treats a half-read coordinate pair as unreadable, not as a placed row", () => {
    // `lng` null with `lat` set used to slip past a check that only tested lat.
    const { drafts } = buildDraftPlaces(
      [{ Name: "Shop", Street: "Main St", Lat: "54.687", Lng: "n/a" }],
      { ...mapping, lat: "Lat", lng: "Lng" },
    );

    expect(drafts[0].lat).toBeNull();
    expect(drafts[0].lng).toBeNull();
    expect(messagesOn(drafts[0].issues, "coordinates")).toContain("54.687");
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

describe("recomputeIssues", () => {
  const placedButUnnamed = (): DraftPlace => {
    const { drafts } = buildDraftPlaces(
      [{ Name: "", Street: "", Lat: "54.687", Lng: "25.28" }],
      { ...mapping, lat: "Lat", lng: "Lng" },
    );

    return drafts[0];
  };

  it("keeps a missing name blocking when the pin is moved", () => {
    // The bug this replaces: the map's drag handler wrote `problem: null`, which
    // let an unnamed row into the import and killed the whole run at preflight.
    const dragged: DraftPlace = {
      ...placedButUnnamed(),
      lat: 54.7,
      lng: 25.3,
      status: "manual",
    };

    expect(messagesOn(recomputeIssues(dragged), "name")).toContain("no name");
  });

  it("clears the address error once a name and a position are both there", () => {
    const draft = placedButUnnamed();
    const fixed: DraftPlace = { ...draft, name: "Corner Shop" };

    expect(recomputeIssues(fixed)).toEqual([]);
  });

  it("drops the unreadable-coordinate note once the pin is placed by hand", () => {
    const { drafts } = buildDraftPlaces(
      [{ Name: "Mystery Shop", Street: "USA", GPS: "invalid_geo" }],
      { ...mapping, latlng: "GPS" },
    );

    const placed: DraftPlace = {
      ...drafts[0],
      lat: 40.71,
      lng: -74.01,
      status: "manual",
    };

    expect(recomputeIssues(placed)).toEqual([]);
  });

  it("keeps the note while the row is still standing on a geocoded guess", () => {
    const { drafts } = buildDraftPlaces(
      [{ Name: "Mystery Shop", Street: "USA", GPS: "invalid_geo" }],
      { ...mapping, latlng: "GPS" },
    );

    const geocoded: DraftPlace = {
      ...drafts[0],
      lat: 39.78,
      lng: -100.44,
      status: "low",
      confidence: 0.4,
    };

    expect(messagesOn(recomputeIssues(geocoded), "coordinates")).toContain(
      "invalid_geo",
    );
  });

  it("tells a row that was never looked up from one that was and found nothing", () => {
    const { drafts } = buildDraftPlaces([{ Name: "Shop", Street: "Main St" }], mapping);

    expect(messagesOn(drafts[0].issues, "address")).toContain("hasn't been looked up");

    const searched: DraftPlace = { ...drafts[0], status: "failed" };
    expect(messagesOn(recomputeIssues(searched), "address")).toContain(
      "couldn't find this address",
    );
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
