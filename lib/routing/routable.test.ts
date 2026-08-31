import { describe, expect, it } from "vitest";

import { ROUTE_SNAP_MAX_DISTANCE_M, isRoutableSnap } from "./routable";

describe("isRoutableSnap", () => {
  it("refuses a point with no road within the engine's reach", () => {
    // A null snap is OSRM's `NoSegment`, which is the failure the route tool
    // exists to catch before anybody clicks.
    expect(isRoutableSnap(null)).toBe(false);
  });

  it("accepts a pin standing on a road", () => {
    expect(isRoutableSnap({ snapM: 0 })).toBe(true);
    expect(isRoutableSnap({ snapM: 12 })).toBe(true);
  });

  it("accepts a rural pin at the end of an unmapped track", () => {
    // The case the ceiling is generous for: a real location, reachable, just
    // not on a road the map draws.
    expect(isRoutableSnap({ snapM: 1500 })).toBe(true);
  });

  it("refuses a pin further out than the ceiling", () => {
    expect(isRoutableSnap({ snapM: ROUTE_SNAP_MAX_DISTANCE_M })).toBe(true);
    expect(isRoutableSnap({ snapM: ROUTE_SNAP_MAX_DISTANCE_M + 1 })).toBe(false);
  });
});
