import { describe, expect, it } from "vitest";

import type { LineGeometry, LngLatTuple } from "@/packages/shared/shapes";
import { placeIndex, type LocatedPlace } from "./line-endpoints";
import {
  ROUTE_STALE_THRESHOLD_M,
  isRouteStale,
  resolvedStops,
} from "./route-staleness";

const DEPOT: LngLatTuple = [25.28, 54.687];
const SHOP: LngLatTuple = [25.3, 54.7];

function routed(overrides: Partial<LineGeometry> = {}): LineGeometry {
  return {
    kind: "line",
    // Stand-in for a road path. Nothing here reads it — the stops are what
    // staleness is decided from.
    points: [DEPOT, [25.29, 54.693], SHOP],
    from: "depot",
    to: "shop",
    route: {
      profile: "car",
      stops: [{ at: DEPOT, placeId: "depot" }, { at: SHOP, placeId: "shop" }],
      durationS: 900,
    },
    ...overrides,
  };
}

function index(places: LocatedPlace[]) {
  return placeIndex(places);
}

/** `metres` north of a point, near enough for these distances. */
function north(from: LngLatTuple, metres: number): LocatedPlace {
  return { id: "", lng: from[0], lat: from[1] + metres / 111_320 };
}

describe("isRouteStale", () => {
  it("is false when every stop is where the route left it", () => {
    const places = index([
      { id: "depot", lng: DEPOT[0], lat: DEPOT[1] },
      { id: "shop", lng: SHOP[0], lat: SHOP[1] },
    ]);

    expect(isRouteStale(routed(), places)).toBe(false);
  });

  it("is false for a nudge inside the threshold", () => {
    // A pin dragged a few metres is still on the same road. Rerouting would
    // return the same geometry, so a badge here is one people learn to ignore.
    const moved = north(DEPOT, ROUTE_STALE_THRESHOLD_M / 5);
    const places = index([
      { ...moved, id: "depot" },
      { id: "shop", lng: SHOP[0], lat: SHOP[1] },
    ]);

    expect(isRouteStale(routed(), places)).toBe(false);
  });

  it("is true once a stop has moved further than the threshold", () => {
    const moved = north(DEPOT, 200);
    const places = index([
      { ...moved, id: "depot" },
      { id: "shop", lng: SHOP[0], lat: SHOP[1] },
    ]);

    expect(isRouteStale(routed(), places)).toBe(true);
  });

  it("ignores a stop whose location has been deleted", () => {
    // The same dangling-id contract the line's own bonds have: a missing id
    // reads as "not bonded", so nothing has to clean up after a delete.
    const places = index([{ id: "shop", lng: SHOP[0], lat: SHOP[1] }]);

    expect(isRouteStale(routed(), places)).toBe(false);
  });

  it("ignores free waypoints, which have nothing to drift from", () => {
    const geometry = routed({
      route: {
        profile: "car",
        stops: [{ at: DEPOT }, { at: SHOP }],
        durationS: 900,
      },
    });

    expect(isRouteStale(geometry, index([]))).toBe(false);
  });

  it("is false for a hand-drawn line, which has no route to be stale", () => {
    const line: LineGeometry = { kind: "line", points: [DEPOT, SHOP], from: "depot" };
    const places = index([{ id: "depot", lng: 1, lat: 1 }]);

    expect(isRouteStale(line, places)).toBe(false);
  });
});

describe("resolvedStops", () => {
  it("moves a bonded stop to where its pin is now", () => {
    const moved = north(DEPOT, 200);
    const places = index([
      { ...moved, id: "depot" },
      { id: "shop", lng: SHOP[0], lat: SHOP[1] },
    ]);

    const stops = resolvedStops(routed(), places);

    // This is what "Recalculate" sends: the question as it stands, not the one
    // the engine was asked last time.
    expect(stops[0].at).toEqual([moved.lng, moved.lat]);
    expect(stops[0].placeId).toBe("depot");
    expect(stops[1].at).toEqual(SHOP);
  });

  it("keeps a deleted location's stored coordinates", () => {
    const stops = resolvedStops(routed(), index([]));

    expect(stops.map((stop) => stop.at)).toEqual([DEPOT, SHOP]);
  });

  it("is empty for a line with no route", () => {
    expect(resolvedStops({ kind: "line", points: [DEPOT] }, index([]))).toEqual([]);
  });
});
