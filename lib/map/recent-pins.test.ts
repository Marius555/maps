import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { recentPinIcons } from "./recent-pins";

const CUSTOM: CustomPinIcon[] = [
  { id: "ab12", label: "Flagship", color: "#1c7ed6", glyph: "store", image: "" },
];

/** Only the three fields this reads are meaningful; the rest is filler. */
function place(icon: string, updatedAt: string): Place {
  return {
    id: `place-${updatedAt}`,
    mapId: "map-1",
    name: "Somewhere",
    lat: 54.687,
    lng: 25.28,
    address: "",
    category: "",
    tags: [],
    fields: {},
    icon,
    description: null,
    phone: null,
    email: null,
    url: null,
    hours: null,
    photoId: null,
    photoUrl: null,
    sortOrder: 0,
    geocodeConfidence: null,
    geocodeStatus: "manual",
    addressParts: null,
    groupId: "",
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("recentPinIcons", () => {
  it("offers the two most recently used, newest first", () => {
    const places = [
      place("coffee", "2026-08-01T00:00:00.000Z"),
      place("bed", "2026-08-03T00:00:00.000Z"),
      place("store", "2026-08-02T00:00:00.000Z"),
    ];

    expect(recentPinIcons(places, [])).toEqual(["bed", "store"]);
  });

  it("counts a pin once however many locations wear it", () => {
    const places = [
      place("bed", "2026-08-03T00:00:00.000Z"),
      place("bed", "2026-08-02T00:00:00.000Z"),
      place("coffee", "2026-08-01T00:00:00.000Z"),
    ];

    expect(recentPinIcons(places, [])).toEqual(["bed", "coffee"]);
  });

  it("includes the customer's own pins", () => {
    const places = [place("custom:ab12", "2026-08-03T00:00:00.000Z")];

    expect(recentPinIcons(places, CUSTOM)).toEqual(["custom:ab12", "store"]);
  });

  /*
   * Cell one of the grid is already the plain pin, so anything that resolves to
   * one would be a duplicate sitting next to it — and a deleted custom pin is
   * exactly that, on every place that still names it.
   */
  it("skips pins that would draw as a plain one", () => {
    const places = [
      place("", "2026-08-04T00:00:00.000Z"),
      place("custom:gone", "2026-08-03T00:00:00.000Z"),
      place("not-an-icon", "2026-08-02T00:00:00.000Z"),
      place("coffee", "2026-08-01T00:00:00.000Z"),
    ];

    expect(recentPinIcons(places, CUSTOM)).toEqual(["coffee", "store"]);
  });

  it("fills an empty map from the built-ins rather than leaving gaps", () => {
    expect(recentPinIcons([], [])).toEqual(["store", "utensils"]);
  });

  it("does not repeat a used pin when padding", () => {
    const places = [place("store", "2026-08-01T00:00:00.000Z")];

    expect(recentPinIcons(places, [])).toEqual(["store", "utensils"]);
  });
});
