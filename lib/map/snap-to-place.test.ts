import { describe, expect, it } from "vitest";

import { SNAP_RADIUS_PX, snapToPlace, type Located } from "./snap-to-place";

/**
 * A fake projection: one degree is one hundred pixels, and screen y runs the
 * opposite way to latitude.
 *
 * A stand-in for MapLibre's `project`, which is the whole reason this function
 * takes the projection rather than a map — the decision is about pixels, and a
 * pixel is a pixel whatever produced it.
 */
function project(place: Located): { x: number; y: number } {
  return { x: place.lng * 100, y: -place.lat * 100 };
}

const ORIGIN: Located = { id: "origin", lng: 0, lat: 0 };
const NEAR: Located = { id: "near", lng: 0.05, lat: 0 };
const FAR: Located = { id: "far", lng: 5, lat: 5 };

describe("snapToPlace", () => {
  it("finds nothing in an empty list", () => {
    expect(snapToPlace([], { x: 0, y: 0 }, project)).toBeNull();
  });

  it("snaps to a location under the cursor", () => {
    const snap = snapToPlace([ORIGIN], { x: 2, y: 2 }, project);

    expect(snap?.placeId).toBe("origin");
    // The location's own coordinates, not the cursor's. The point of a magnet is
    // that the result is exact rather than merely close.
    expect(snap?.point).toEqual([0, 0]);
  });

  it("ignores a location beyond the threshold", () => {
    expect(snapToPlace([FAR], { x: 0, y: 0 }, project)).toBeNull();
  });

  it("takes the nearest when two are in range", () => {
    // ORIGIN sits at x=0, NEAR at x=5. From x=4 the nearer one is NEAR.
    const snap = snapToPlace([ORIGIN, NEAR], { x: 4, y: 0 }, project);

    expect(snap?.placeId).toBe("near");
  });

  it("measures in screen pixels, not degrees", () => {
    /*
     * The same two coordinates at two zoom levels. A magnet measured in metres
     * would be irresistible at one and useless at the other, with nothing on
     * screen explaining why.
     */
    const zoomedOut = (place: Located) => ({ x: place.lng * 10, y: -place.lat * 10 });
    const zoomedIn = (place: Located) => ({ x: place.lng * 1000, y: -place.lat * 1000 });

    const at = { x: 0, y: 0 };

    // Zoomed out, NEAR projects to x=0.5 — within reach.
    expect(snapToPlace([NEAR], at, zoomedOut)?.placeId).toBe("near");
    // Zoomed in it projects to x=50, which is off the magnet entirely.
    expect(snapToPlace([NEAR], at, zoomedIn)).toBeNull();
  });

  it("excludes a location exactly on the threshold", () => {
    const edge: Located = { id: "edge", lng: SNAP_RADIUS_PX / 100, lat: 0 };

    // Strictly-less, so a location sitting precisely at the boundary does not
    // flicker in and out as the cursor wobbles by a subpixel.
    expect(snapToPlace([edge], { x: 0, y: 0 }, project)).toBeNull();
  });

  it("resolves two locations at the same spot to the first", () => {
    const twin: Located = { id: "twin", lng: 0, lat: 0 };
    const snap = snapToPlace([ORIGIN, twin], { x: 0, y: 0 }, project);

    expect(snap?.placeId).toBe("origin");
  });

  it("honours a threshold the caller sets", () => {
    expect(snapToPlace([FAR], { x: 0, y: 0 }, project, 1000)?.placeId).toBe("far");
  });
});
