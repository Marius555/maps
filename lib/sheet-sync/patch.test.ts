import { describe, expect, it } from "vitest";

import { isEmptyPatch, sheetPatch } from "./patch";
import { BASIC_MAPPING, linkedPlace, sheetRowsFrom } from "./test-helpers";

describe("sheetPatch", () => {
  it("writes nothing when the row and the location agree", () => {
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St", phone: "123" });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub", Address: "1 High St", Phone: "123", Tags: "" },
    ]);

    const { patch, needsGeocode } = sheetPatch(place, row, BASIC_MAPPING, []);

    expect(isEmptyPatch(patch)).toBe(true);
    expect(needsGeocode).toBe(false);
  });

  it("takes the sheet's value for a mapped field", () => {
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St", phone: "123" });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub", Address: "1 High St", Phone: "999", Tags: "" },
    ]);

    expect(sheetPatch(place, row, BASIC_MAPPING, []).patch).toEqual({ phone: "999" });
  });

  it("clears a mapped field the sheet emptied", () => {
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St", phone: "123" });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub", Address: "1 High St", Phone: "", Tags: "" },
    ]);

    expect(sheetPatch(place, row, BASIC_MAPPING, []).patch).toEqual({ phone: null });
  });

  it("leaves a field alone when no column feeds it", () => {
    // No email column, so an email typed in the app survives every sync.
    const place = linkedPlace({
      name: "Bike Hub",
      address: "1 High St",
      email: "hello@bikehub.test",
    });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub", Address: "1 High St", Phone: "", Tags: "" },
    ]);

    expect(sheetPatch(place, row, BASIC_MAPPING, []).patch).toEqual({});
  });

  it("asks for a lookup when the address changed and the sheet has no coordinates", () => {
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St" });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub", Address: "9 New Rd", Phone: "", Tags: "" },
    ]);

    const result = sheetPatch(place, row, BASIC_MAPPING, []);

    expect(result.needsGeocode).toBe(true);
    expect(result.patch.address).toBe("9 New Rd");
    expect(result.patch.lat).toBeUndefined();
  });

  it("keeps a hand-placed pin while the address is unchanged", () => {
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St", lat: 1, lng: 2 });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub", Address: " 1  high st ", Phone: "", Tags: "" },
    ]);

    const result = sheetPatch(place, row, BASIC_MAPPING, []);

    expect(result.needsGeocode).toBe(false);
    expect(result.patch).toEqual({});
  });

  it("moves the pin to coordinates typed into the sheet", () => {
    const mapping = { ...BASIC_MAPPING, lat: "Lat", lng: "Lng" };
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St", lat: 1, lng: 2 });
    const [row] = sheetRowsFrom(
      [{ Name: "Bike Hub", Address: "1 High St", Phone: "", Tags: "", Lat: "48.1", Lng: "11.5" }],
      mapping,
    );

    const result = sheetPatch(place, row, mapping, []);

    expect(result.needsGeocode).toBe(false);
    expect(result.patch).toMatchObject({
      lat: 48.1,
      lng: 11.5,
      geocodeStatus: "manual",
      geocodeConfidence: null,
    });
  });

  it("treats a reordered tag list as a change, because the first tag colours the pin", () => {
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St", tags: ["a", "b"] });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub", Address: "1 High St", Phone: "", Tags: "B, A" },
    ]);

    expect(sheetPatch(place, row, BASIC_MAPPING, ["b", "a"]).patch).toEqual({
      tags: ["b", "a"],
    });
    expect(sheetPatch(place, row, BASIC_MAPPING, ["a", "b"]).patch).toEqual({});
  });

  it("rewrites the key of a location matched by name or address", () => {
    const place = linkedPlace({ name: "Bike Hub", address: "1 High St" });
    const [row] = sheetRowsFrom([
      { Name: "Bike Hub Central", Address: "1 High St", Phone: "", Tags: "" },
    ]);

    const { patch } = sheetPatch(place, row, BASIC_MAPPING, []);

    expect(patch.name).toBe("Bike Hub Central");
    expect(patch.sourceKey).toBe(row.key);
  });
});
