import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/repositories/types";
import { describeMissing, isIncomplete, missingFields } from "./completeness";
import {
  countNeedingAttention,
  matchesFilter,
  matchesTagFilter,
  needsAttention,
  UNTAGGED_FILTER_ID,
} from "./place-filters";

/** A location with nothing wrong with it and nothing missing. */
function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    mapId: "map-1",
    name: "Corner Shop",
    lat: 54.687,
    lng: 25.28,
    address: "Gedimino pr. 9, Vilnius",
    tags: ["tag-1"],
    fields: {},
    icon: "",
    description: "A shop on a corner.",
    phone: "+370 5 123 4567",
    email: "hello@example.com",
    url: "https://example.com",
    hours: [null, null, null, null, null, null, null],
    photoIds: ["photo-1"],
    photoUrls: ["https://cdn.example.com/photo-1"],
    photoUrl: "https://cdn.example.com/photo-1",
    sortOrder: 0,
    geocodeConfidence: 0.95,
    geocodeStatus: "ok",
    addressParts: null,
    groupId: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("needsAttention", () => {
  it("leaves a confident geocoded pin alone", () => {
    expect(needsAttention(place())).toBe(false);
  });

  it("catches a pin the geocoder could not place", () => {
    expect(needsAttention(place({ geocodeStatus: "failed" }))).toBe(true);
  });

  it("catches a vague match", () => {
    expect(
      needsAttention(place({ geocodeStatus: "low", geocodeConfidence: 0.4 })),
    ).toBe(true);
  });

  it("catches a hand-placed pin whose address only reached the street", () => {
    // The opposite failure: the position is right and the address is short a
    // house number. "Show me what to look at" wants both.
    expect(
      needsAttention(place({ geocodeStatus: "manual", geocodeConfidence: 0.7 })),
    ).toBe(true);
  });

  it("leaves a hand-placed pin with a precise address alone", () => {
    expect(
      needsAttention(place({ geocodeStatus: "manual", geocodeConfidence: 0.95 })),
    ).toBe(false);
  });

  it("leaves a hand-placed pin no geocoder ever spoke for alone", () => {
    // A pin dropped and never reverse-geocoded has nothing to be approximate
    // about, and flagging it would put a badge on every pin placed by hand.
    expect(
      needsAttention(place({ geocodeStatus: "manual", geocodeConfidence: null })),
    ).toBe(false);
  });
});

describe("matchesFilter", () => {
  const failed = place({ geocodeStatus: "failed" });
  const low = place({ geocodeStatus: "low", geocodeConfidence: 0.4 });
  const approximate = place({
    geocodeStatus: "manual",
    geocodeConfidence: 0.7,
  });
  const bare = place({ phone: null, email: null, url: null });

  it("passes everything through the empty filter", () => {
    for (const candidate of [place(), failed, low, approximate, bare]) {
      expect(matchesFilter(candidate, "")).toBe(true);
    }
  });

  it("separates the two kinds of suspect pin", () => {
    expect(matchesFilter(failed, "failed")).toBe(true);
    expect(matchesFilter(low, "failed")).toBe(false);

    expect(matchesFilter(low, "low")).toBe(true);
    expect(matchesFilter(approximate, "low")).toBe(false);

    expect(matchesFilter(approximate, "approximate")).toBe(true);
    expect(matchesFilter(failed, "approximate")).toBe(false);
  });

  it("gathers all of them under one heading", () => {
    for (const candidate of [failed, low, approximate]) {
      expect(matchesFilter(candidate, "attention")).toBe(true);
    }

    expect(matchesFilter(place(), "attention")).toBe(false);
  });

  it("finds rows with details missing, whatever their pin is doing", () => {
    expect(matchesFilter(bare, "incomplete")).toBe(true);
    expect(matchesFilter(place(), "incomplete")).toBe(false);
  });
});

describe("countNeedingAttention", () => {
  it("counts each suspect row once", () => {
    const places = [
      place(),
      place({ geocodeStatus: "failed" }),
      place({ geocodeStatus: "low", geocodeConfidence: 0.3 }),
      place({ geocodeStatus: "manual", geocodeConfidence: 0.6 }),
    ];

    expect(countNeedingAttention(places)).toBe(3);
  });
});

describe("completeness", () => {
  it("reports nothing missing on a full location", () => {
    expect(missingFields(place())).toEqual([]);
    expect(isIncomplete(place())).toBe(false);
  });

  it("counts a photo present from the gallery alone", () => {
    // `photoUrl` is only the cover; the gallery is what says there is a photo.
    expect(missingFields(place({ photoUrl: null }))).toEqual([]);
    expect(missingFields(place({ photoIds: [], photoUrls: [] }))).toEqual([
      "photo",
    ]);
  });

  it("treats hours as set once any day is filled in", () => {
    expect(missingFields(place({ hours: null }))).toEqual(["hours"]);
  });

  it("names the gaps in one sentence", () => {
    const gaps = missingFields(place({ phone: null, url: null, hours: null }));

    expect(gaps).toEqual(["phone", "url", "hours"]);
    expect(describeMissing(gaps)).toBe("No phone, website or opening hours");
  });

  it("says nothing when there is nothing to say", () => {
    expect(describeMissing([])).toBe("");
  });
});

describe("matchesTagFilter", () => {
  /** "Bikes" and "Sundays" answer different questions; "Skis" shares Bikes'. */
  const groupOf = new Map([
    ["tag-1", "grp-sells"],
    ["tag-skis", "grp-sells"],
    ["tag-sun", "grp-open"],
  ]);

  it("is no filter when nothing is selected", () => {
    expect(matchesTagFilter(place(), new Set(), groupOf)).toBe(true);
    expect(matchesTagFilter(place({ tags: [] }), new Set(), groupOf)).toBe(true);
  });

  it("keeps the embed's rule: OR inside a group, AND across them", () => {
    const worn = place({ tags: ["tag-1", "tag-sun"] });

    // Same group: a second answer widens.
    expect(matchesTagFilter(worn, new Set(["tag-1", "tag-skis"]), groupOf)).toBe(
      true,
    );
    // Different groups: both have to be answered.
    expect(matchesTagFilter(worn, new Set(["tag-1", "tag-sun"]), groupOf)).toBe(
      true,
    );
    expect(
      matchesTagFilter(place({ tags: ["tag-1"] }), new Set(["tag-sun"]), groupOf),
    ).toBe(false);
  });

  it("finds the locations nothing landed on", () => {
    const selected = new Set([UNTAGGED_FILTER_ID]);

    expect(matchesTagFilter(place({ tags: [] }), selected, groupOf)).toBe(true);
    expect(matchesTagFilter(place({ tags: ["tag-1"] }), selected, groupOf)).toBe(
      false,
    );
  });

  it("lets Untagged win over a real tag rather than returning nothing", () => {
    // The menu keeps the two apart, and this is what happens if anything ever
    // gets past it: a location cannot be untagged *and* wear Bikes, so the
    // combination would otherwise be a filter with no possible answer.
    const selected = new Set([UNTAGGED_FILTER_ID, "tag-1"]);

    expect(matchesTagFilter(place({ tags: [] }), selected, groupOf)).toBe(true);
  });
});
