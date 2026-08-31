import { describe, expect, it } from "vitest";

import { MAX_ROUTE_STOPS } from "@/lib/validation/shape.schema";
import type { LngLatTuple, RouteStop } from "@/packages/shared/shapes";
import type { Snap } from "./snap-to-place";
import { appendStop, canRemoveStop, removeStopAt } from "./route-stops";

const DEPOT: LngLatTuple = [25.28, 54.687];
const SHOP: LngLatTuple = [25.3, 54.7];
const PORT: LngLatTuple = [21.14, 55.7];

const onDepot: Snap = { point: DEPOT, placeId: "depot" };
const onShop: Snap = { point: SHOP, placeId: "shop" };

function stop(at: LngLatTuple, placeId: string): RouteStop {
  return { at, placeId };
}

describe("appendStop", () => {
  it("adds the location a click landed on", () => {
    expect(appendStop([], onDepot)).toEqual([stop(DEPOT, "depot")]);
  });

  it("keeps the order the stops were clicked in", () => {
    const first = appendStop([], onDepot) ?? [];

    expect(appendStop(first, onShop)).toEqual([
      stop(DEPOT, "depot"),
      stop(SHOP, "shop"),
    ]);
  });

  it("adds nothing when the click was not on a pin", () => {
    // What `snapToPlace` returns for empty ground. A route between arbitrary
    // points is not a route anything can later tell you has gone stale.
    expect(appendStop([stop(DEPOT, "depot")], null)).toBeNull();
  });

  it("adds nothing for a snap that carries no location", () => {
    expect(appendStop([], { point: SHOP, placeId: null })).toBeNull();
  });

  it("ignores the pin that is already the last stop", () => {
    // The second click of the double-click that finishes the route.
    expect(appendStop([stop(DEPOT, "depot")], onDepot)).toBeNull();
  });

  it("allows a pin that is earlier in the route but not last", () => {
    // A round trip back to the depot is a real route, and only *consecutive*
    // repeats are the zero-length leg worth refusing.
    const stops = [stop(DEPOT, "depot"), stop(SHOP, "shop")];

    expect(appendStop(stops, onDepot)).toHaveLength(3);
  });

  it("refuses to go past the cap", () => {
    const full = Array.from({ length: MAX_ROUTE_STOPS }, (_, index) =>
      stop(PORT, `place-${index}`),
    );

    expect(appendStop(full, onDepot)).toBeNull();
  });
});

describe("removeStopAt", () => {
  const three = [
    stop(DEPOT, "depot"),
    stop(SHOP, "shop"),
    stop(PORT, "port"),
  ];

  it("drops the stop and keeps the rest in order", () => {
    expect(removeStopAt(three, 1)).toEqual([
      stop(DEPOT, "depot"),
      stop(PORT, "port"),
    ]);
  });

  it("refuses at two stops, which is the fewest a path can have", () => {
    expect(canRemoveStop(three.slice(0, 2), 0)).toBe(false);
    expect(removeStopAt(three.slice(0, 2), 0)).toBeNull();
  });

  it("refuses an index that is not a stop", () => {
    expect(removeStopAt(three, 3)).toBeNull();
    expect(removeStopAt(three, -1)).toBeNull();
  });

  /*
   * The round trip, which is what made removal per-row rather than per-route.
   * Found by drawing one in the browser: taking the middle out left a journey
   * from a place to itself, nought metres long, with no × left to undo it.
   */
  describe("on a round trip", () => {
    const loop = [
      stop(DEPOT, "depot"),
      stop(SHOP, "shop"),
      stop(DEPOT, "depot"),
    ];

    it("refuses the middle stop, which would leave a route to nowhere", () => {
      expect(removeStopAt(loop, 1)).toBeNull();
      expect(canRemoveStop(loop, 1)).toBe(false);
    });

    it("still allows either end", () => {
      expect(canRemoveStop(loop, 0)).toBe(true);
      expect(removeStopAt(loop, 0)).toEqual([
        stop(SHOP, "shop"),
        stop(DEPOT, "depot"),
      ]);
      expect(removeStopAt(loop, 2)).toEqual([
        stop(DEPOT, "depot"),
        stop(SHOP, "shop"),
      ]);
    });
  });

  it("never merges two free waypoints, which share an absent id", () => {
    // Only a route drawn before stops had to be locations has these. Comparing
    // ids alone would read two different points as one and delete a stop
    // nobody touched.
    const legacy: RouteStop[] = [
      { at: DEPOT },
      { at: SHOP },
      { at: PORT },
      { at: DEPOT },
    ];

    expect(removeStopAt(legacy, 0)).toEqual([
      { at: SHOP },
      { at: PORT },
      { at: DEPOT },
    ]);
  });
});
