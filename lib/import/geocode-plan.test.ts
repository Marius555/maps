import { describe, expect, it } from "vitest";

import type { DraftPlace } from "./draft-places";
import {
  estimateGeocodeMs,
  normalizeAddress,
  planGeocode,
} from "./geocode-plan";

/**
 * A draft as `buildDraftPlaces` leaves one that still needs an address looked
 * up: `pending`, with an address and no issue on its name. Every other shape is
 * built by overriding one field, so each test says only what it is about.
 */
function draft(overrides: Partial<DraftPlace> = {}): DraftPlace {
  return {
    key: "k1",
    rowNumber: 1,
    name: "Corner Shop",
    address: "Gedimino pr. 9, Vilnius",
    categoryLabel: "",
    tagLabels: [],
    description: "",
    phone: "",
    email: "",
    url: "",
    lat: null,
    lng: null,
    status: "pending",
    matchedLabel: null,
    confidence: null,
    issues: [],
    alternatives: [],
    ...overrides,
  } as DraftPlace;
}

describe("normalizeAddress", () => {
  it("ignores the ways a spreadsheet differs from itself", () => {
    expect(normalizeAddress("  Gedimino  pr. 9,   Vilnius ")).toBe(
      normalizeAddress("gedimino pr. 9, vilnius"),
    );
  });

  it("keeps two genuinely different addresses apart", () => {
    // The guard on the whole idea: a merge writes one building's coordinates
    // onto another building's row, on rows nobody flagged.
    expect(normalizeAddress("9 High Street")).not.toBe(
      normalizeAddress("9 High Road"),
    );
    expect(normalizeAddress("9 High St")).not.toBe(
      normalizeAddress("9 High Street"),
    );
  });
});

describe("planGeocode", () => {
  it("asks once per distinct address and reports what that saved", () => {
    const plan = planGeocode([
      draft({ key: "a", address: "1 High Street" }),
      draft({ key: "b", address: "1 High Street" }),
      draft({ key: "c", address: "  1 HIGH   street " }),
      draft({ key: "d", address: "2 High Street" }),
    ]);

    expect(plan.rowCount).toBe(4);
    expect(plan.lookupCount).toBe(2);
    expect(plan.savedCount).toBe(2);
    expect(plan.lookups[0].keys).toEqual(["a", "b", "c"]);
    expect(plan.lookups[1].keys).toEqual(["d"]);
  });

  it("sends the address the user wrote, not the normalised key", () => {
    // Normalising is how we decide two rows ask the same question. It is not a
    // better question to ask the geocoder than the one on the row.
    const plan = planGeocode([draft({ address: "  1 High  Street " })]);

    expect(plan.lookups[0].address).toBe("  1 High  Street ");
  });

  it("keeps the file's own order", () => {
    const plan = planGeocode([
      draft({ key: "a", address: "Zeta" }),
      draft({ key: "b", address: "Alpha" }),
      draft({ key: "c", address: "Zeta" }),
    ]);

    expect(plan.lookups.map((lookup) => lookup.address)).toEqual([
      "Zeta",
      "Alpha",
    ]);
  });

  it("costs nothing when there is nothing to save", () => {
    const plan = planGeocode([
      draft({ key: "a", address: "1 High Street" }),
      draft({ key: "b", address: "2 High Street" }),
    ]);

    expect(plan.lookupCount).toBe(plan.rowCount);
    expect(plan.savedCount).toBe(0);
  });

  it("leaves out rows that are not waiting on the geocoder", () => {
    const plan = planGeocode([
      draft({ key: "a" }),
      // Already placed from the file's own coordinates.
      draft({ key: "b", status: "manual", lat: 54.6, lng: 25.2 }),
      // Nothing to look up.
      draft({ key: "c", address: "" }),
      // Unimportable whatever the geocoder says.
      draft({
        key: "d",
        name: "",
        issues: [
          { field: "name", severity: "error", message: "This row has no name." },
        ],
      }),
    ]);

    expect(plan.rowCount).toBe(1);
    expect(plan.lookups).toHaveLength(1);
    expect(plan.lookups[0].keys).toEqual(["a"]);
  });

  it("has nothing to do with an empty file", () => {
    expect(planGeocode([])).toEqual({
      lookups: [],
      rowCount: 0,
      lookupCount: 0,
      savedCount: 0,
    });
  });
});

describe("estimateGeocodeMs", () => {
  it("is the pacing plus one round trip per chunk", () => {
    expect(
      estimateGeocodeMs({
        lookupCount: 50,
        paceMs: 220,
        batchSize: 25,
        latencyMs: 400,
      }),
    ).toBe(50 * 220 + 2 * 400);
  });

  it("is zero when there is nothing to look up", () => {
    expect(
      estimateGeocodeMs({ lookupCount: 0, paceMs: 220, batchSize: 25 }),
    ).toBe(0);
  });

  it("still charges a whole round trip for a part-full chunk", () => {
    expect(
      estimateGeocodeMs({
        lookupCount: 1,
        paceMs: 220,
        batchSize: 25,
        latencyMs: 400,
      }),
    ).toBe(220 + 400);
  });
});
