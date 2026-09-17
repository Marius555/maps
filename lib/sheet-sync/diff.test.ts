import { describe, expect, it } from "vitest";

import { diffSheet } from "./diff";
import { linkedPlace, sheetRowsFrom } from "./test-helpers";

const row = (Name: string, Address: string) => ({ Name, Address, Phone: "", Tags: "" });

describe("diffSheet", () => {
  it("matches unchanged rows by key and adds nothing", () => {
    const hub = linkedPlace({ name: "Bike Hub", address: "1 High St" });
    const cafe = linkedPlace({ name: "Cafe", address: "2 Low Rd" });

    const diff = diffSheet(
      [hub, cafe],
      sheetRowsFrom([row("Bike Hub", "1 High St"), row("Cafe", "2 Low Rd")]),
    );

    expect(diff.matches.map((match) => match.place.id)).toEqual([hub.id, cafe.id]);
    expect(diff.adds).toEqual([]);
    expect(diff.removals).toEqual([]);
  });

  it("keeps a renamed location by matching its address", () => {
    const hub = linkedPlace({ name: "Bike Hub", address: "1 High St" });

    const diff = diffSheet([hub], sheetRowsFrom([row("Bike Hub Central", "1 High St")]));

    expect(diff.matches).toHaveLength(1);
    expect(diff.matches[0].place.id).toBe(hub.id);
    expect(diff.adds).toEqual([]);
    expect(diff.removals).toEqual([]);
  });

  it("keeps a moved location by matching its name", () => {
    const hub = linkedPlace({ name: "Bike Hub", address: "1 High St" });

    const diff = diffSheet([hub], sheetRowsFrom([row("Bike Hub", "9 New Rd")]));

    expect(diff.matches[0]?.place.id).toBe(hub.id);
    expect(diff.removals).toEqual([]);
  });

  it("treats a row changed in both name and address as a new location", () => {
    const hub = linkedPlace({ name: "Bike Hub", address: "1 High St" });

    const diff = diffSheet([hub], sheetRowsFrom([row("Cycle Shop", "9 New Rd")]));

    expect(diff.matches).toEqual([]);
    expect(diff.adds).toHaveLength(1);
    expect(diff.removals).toEqual([hub]);
  });

  it("never guesses between two locations sharing a name", () => {
    const north = linkedPlace({ name: "Kiosk", address: "North Gate" });
    const south = linkedPlace({ name: "Kiosk", address: "South Gate" });

    // Both moved. By name alone either could be either.
    const diff = diffSheet(
      [north, south],
      sheetRowsFrom([row("Kiosk", "East Gate"), row("Kiosk", "West Gate")]),
    );

    expect(diff.matches).toEqual([]);
    expect(diff.adds).toHaveLength(2);
    expect(diff.removals).toHaveLength(2);
  });

  it("removes a location whose row is gone and adds a new row", () => {
    const hub = linkedPlace({ name: "Bike Hub", address: "1 High St" });
    const cafe = linkedPlace({ name: "Cafe", address: "2 Low Rd" });

    const diff = diffSheet(
      [hub, cafe],
      sheetRowsFrom([row("Bike Hub", "1 High St"), row("Bakery", "3 Mill Ln")]),
    );

    expect(diff.matches.map((match) => match.place.id)).toEqual([hub.id]);
    expect(diff.adds.map((add) => add.draft.name)).toEqual(["Bakery"]);
    expect(diff.removals).toEqual([cafe]);
  });

  it("keeps duplicates paired with their own locations", () => {
    const [first, second] = sheetRowsFrom([
      row("Kiosk", "Station"),
      row("Kiosk", "Station"),
    ]);
    const a = { ...linkedPlace({ name: "Kiosk", address: "Station" }), sourceKey: first.key };
    const b = { ...linkedPlace({ name: "Kiosk", address: "Station" }), sourceKey: second.key };

    const diff = diffSheet([a, b], [first, second]);

    expect(diff.matches.map((match) => [match.place.id, match.row.key])).toEqual([
      [a.id, first.key],
      [b.id, second.key],
    ]);
    expect(diff.adds).toEqual([]);
  });
});
