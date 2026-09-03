import { describe, expect, it } from "vitest";

import { shapeSeedColor, seedPlaceId } from "./shape-seed-color";
import type { Place } from "@/lib/repositories/types";
import type { LineGeometry } from "@/packages/shared/shapes";

function place(id: string): Place {
  return {
    id,
    mapId: "map-1",
    name: id,
    lat: 54.687,
    lng: 25.28,
    address: "",
    tags: [],
    icon: "",
    description: null,
    phone: null,
    email: null,
    url: null,
    hours: null,
    fields: {},
    photoIds: [],
    photoUrl: null,
    photoUrls: [],
    sortOrder: 0,
    geocodeConfidence: null,
    addressParts: null,
    groupId: "",
    geocodeStatus: "ok",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

const line: LineGeometry = {
  kind: "line",
  points: [
    [25.28, 54.687],
    [25.3, 54.7],
  ],
};

const routed = (stops: { at: [number, number]; placeId?: string }[]): LineGeometry => ({
  ...line,
  route: { profile: "car", stops, durationS: 600 },
});

const black = () => "#000000";

describe("seedPlaceId", () => {
  it("takes a route's first stop", () => {
    expect(
      seedPlaceId(
        routed([
          { at: [25.28, 54.687], placeId: "a" },
          { at: [25.3, 54.7], placeId: "b" },
        ]),
      ),
    ).toBe("a");
  });

  /*
   * Free waypoints were withdrawn but rows holding them still load, and a stop
   * with no id names nothing that could have a colour. Indexing [0] blindly
   * would read one of those as "no pin" and drop the rule for the whole route.
   */
  it("skips a leading free waypoint", () => {
    expect(
      seedPlaceId(routed([{ at: [25.28, 54.687] }, { at: [25.3, 54.7], placeId: "b" }])),
    ).toBe("b");
  });

  it("has nothing to say about a route of free waypoints alone", () => {
    expect(seedPlaceId(routed([{ at: [25.28, 54.687] }, { at: [25.3, 54.7] }]))).toBeNull();
  });

  it("falls back to a hand-drawn line's own bond", () => {
    expect(seedPlaceId({ ...line, from: "a", to: "b" })).toBe("a");
    expect(seedPlaceId(line)).toBeNull();
  });

  /*
   * Drawing a line from empty ground onto a pin is the ordinary case, not an
   * edge one — and that line has exactly one pin in it. Reading `from` alone
   * would tell it there is none.
   */
  it("takes the end bond when only the end is a pin", () => {
    expect(seedPlaceId({ ...line, to: "b" })).toBe("b");
  });

  // A circle or a polygon is dragged out over ground, with no pin in the gesture
  // at all — so there is no first pin, and the palette cycle stays in charge.
  it("has nothing to say about an area", () => {
    expect(seedPlaceId({ kind: "circle", lng: 25.28, lat: 54.687, radius: 500 })).toBeNull();
    expect(
      seedPlaceId({
        kind: "polygon",
        points: [
          [25.28, 54.687],
          [25.3, 54.7],
          [25.29, 54.69],
        ],
      }),
    ).toBeNull();
  });
});

describe("shapeSeedColor", () => {
  it("takes the first pin's colour", () => {
    const geometry = routed([
      { at: [25.28, 54.687], placeId: "a" },
      { at: [25.3, 54.7], placeId: "b" },
    ]);

    expect(shapeSeedColor(geometry, [place("a"), place("b")], black)).toBe("#000000");
  });

  it("falls back when the bonded location is gone", () => {
    expect(shapeSeedColor({ ...line, from: "a" }, [place("z")], black)).toBeNull();
  });

  /*
   * An uncategorised pin has no colour of its own — it is drawn in the theme's
   * accent here and a flat grey once published. Copying that would make every
   * line on an uncategorised map grey, so the palette cycle answers instead.
   */
  it("falls back when the pin has no colour of its own", () => {
    expect(shapeSeedColor({ ...line, from: "a" }, [place("a")], () => undefined)).toBeNull();
  });
});
