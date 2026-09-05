import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/repositories/types";
import { placeSecondLine } from "./place-labels";

/**
 * The line under the address. It began as `place.name`, which for a freshly
 * dropped pin meant printing "Location 1" under a street — a placeholder we
 * invented, quoted back as if it identified something.
 */

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "p1",
    mapId: "m1",
    name: "Location 1",
    lat: 54.69,
    lng: 25.278,
    address: "A. Goštauto g. 1, Vilnius",
    tags: [],
    fields: {},
    icon: "",
    description: null,
    phone: null,
    email: null,
    url: null,
    hours: null,
    photoIds: [],
    photoUrls: [],
    photoUrl: null,
    logoId: null,
    logoUrl: null,
    sortOrder: 0,
    geocodeConfidence: null,
    geocodeStatus: "manual",
    addressParts: null,
    groupId: "",
    cardBlocks: {},
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("placeSecondLine", () => {
  it("puts the landmark right after the postcode", () => {
    // The reported case: the museum belongs on this line, not on the address.
    expect(
      placeSecondLine(
        place({
          addressParts: {
            postcode: "01104",
            name: "Vytautas Kasiulis Museum of Art",
            street: "A. Goštauto g.",
          },
        }),
      ),
    ).toBe("01104 · Vytautas Kasiulis Museum of Art");
  });

  it("is just the postcode for a pin on a plain street", () => {
    expect(
      placeSecondLine(place({ addressParts: { postcode: "91230", street: "Sinagogų g." } })),
    ).toBe("91230");
  });

  it("gives way to the name the customer typed", () => {
    // Their name replaces the venue's rather than joining it — one row, one name.
    expect(
      placeSecondLine(
        place({
          name: "Corner Shop",
          addressParts: { postcode: "01104", name: "Vytautas Kasiulis Museum of Art" },
        }),
      ),
    ).toBe("01104 · Corner Shop");
  });

  it("keeps a real name even with no postcode to lead it", () => {
    expect(placeSecondLine(place({ name: "Corner Shop" }))).toBe("Corner Shop");
  });

  it("says nothing rather than repeating the placeholder name", () => {
    // An old row, geocoded before the parts column existed. Printing "Location 1"
    // here is the bug this line was rewritten to stop.
    expect(placeSecondLine(place())).toBe("");
    expect(placeSecondLine(place({ name: "Location 42" }))).toBe("");
  });

  it("treats a name that merely starts like ours as the customer's own", () => {
    // Same rule nextPlaceDefaults uses when it refuses to renumber this row.
    expect(placeSecondLine(place({ name: "Location 14 (closed)" }))).toBe(
      "Location 14 (closed)",
    );
  });
});
