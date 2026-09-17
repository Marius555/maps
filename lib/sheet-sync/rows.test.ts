import { describe, expect, it } from "vitest";

import { readCsvText } from "@/lib/import/sources/csv";
import { buildTable } from "@/lib/import/table";
import { buildDraftPlaces } from "@/lib/import/draft-places";
import { diffSheet } from "./diff";
import { removalsNeedConfirmation, usableSheetRows } from "./rows";
import { draftsFrom, linkedPlace } from "./test-helpers";

describe("usableSheetRows", () => {
  it("reports rows with no name or nowhere to put them, by sheet row number", () => {
    const { rows, skipped } = usableSheetRows(
      draftsFrom([
        { Name: "Bike Hub", Address: "1 High St", Phone: "", Tags: "" },
        { Name: "", Address: "2 Low Rd", Phone: "", Tags: "" },
        { Name: "Pop-up", Address: "", Phone: "555", Tags: "" },
      ]),
    );

    expect(rows.map((row) => row.draft.name)).toEqual(["Bike Hub"]);
    expect(skipped).toEqual([
      { row: 2, name: "", reason: "This row has no name." },
      { row: 3, name: "Pop-up", reason: "This row has no address and no coordinates." },
    ]);
  });

  it("does not let a broken row renumber the duplicates below it", () => {
    const withBroken = usableSheetRows(
      draftsFrom([
        { Name: "", Address: "Station", Phone: "", Tags: "" },
        { Name: "Kiosk", Address: "Station", Phone: "", Tags: "" },
      ]),
    );
    const without = usableSheetRows(
      draftsFrom([{ Name: "Kiosk", Address: "Station", Phone: "", Tags: "" }]),
    );

    expect(withBroken.rows[0].key).toBe(without.rows[0].key);
  });
});

describe("removalsNeedConfirmation", () => {
  it("lets a row or two go without asking", () => {
    expect(
      removalsNeedConfirmation({ removals: 2, linkedCount: 3, incomingCount: 1 }),
    ).toBe(false);
    expect(
      removalsNeedConfirmation({ removals: 5, linkedCount: 40, incomingCount: 35 }),
    ).toBe(false);
  });

  it("asks before removing most of the map", () => {
    expect(
      removalsNeedConfirmation({ removals: 30, linkedCount: 40, incomingCount: 10 }),
    ).toBe(true);
  });

  it("asks before emptying the map, however small", () => {
    expect(
      removalsNeedConfirmation({ removals: 1, linkedCount: 1, incomingCount: 0 }),
    ).toBe(true);
  });

  it("has nothing to ask when nothing is removed", () => {
    expect(
      removalsNeedConfirmation({ removals: 0, linkedCount: 0, incomingCount: 0 }),
    ).toBe(false);
  });
});

describe("a sheet, from CSV text to what a sync would do", () => {
  it("adds, keeps and removes the right locations", () => {
    const csv = [
      "Store name,Street,City,Telephone",
      "Bike Hub Central,1 High St,Leeds,0113 1",
      "Cafe,2 Low Rd,Leeds,0113 2",
      ",3 Nowhere,Leeds,",
      "Bakery,3 Mill Ln,York,01904 3",
    ].join("\n");

    const mapping = { name: "Store name", address: "Street", city: "City", phone: "Telephone" };
    const table = buildTable(readCsvText(csv, "Google Sheet"), 0);
    const { rows, skipped } = usableSheetRows(buildDraftPlaces(table.rows, mapping).drafts);

    // Renamed since the import; its address still says which location it is.
    const hub = linkedPlace({ name: "Bike Hub", address: "1 High St, Leeds" });
    const cafe = linkedPlace({ name: "Cafe", address: "2 Low Rd, Leeds" });
    const closed = linkedPlace({ name: "Closed Shop", address: "4 Gone St, Leeds" });

    const diff = diffSheet([hub, cafe, closed], rows);

    expect(skipped.map((skip) => skip.row)).toEqual([3]);
    expect(diff.matches.map((match) => match.place.id).sort()).toEqual(
      [hub.id, cafe.id].sort(),
    );
    expect(diff.adds.map((add) => add.draft.name)).toEqual(["Bakery"]);
    expect(diff.removals.map((place) => place.name)).toEqual(["Closed Shop"]);
  });
});
