import { describe, expect, it } from "vitest";

import { placeIndex, resolveGeometry, resolveLine } from "./line-endpoints";
import type { LineGeometry } from "@/packages/shared/shapes";

const OSLO = { id: "oslo", lat: 59.9139, lng: 10.7522 };
const BERGEN = { id: "bergen", lat: 60.3913, lng: 5.3221 };

const index = placeIndex([OSLO, BERGEN]);

function line(overrides: Partial<LineGeometry> = {}): LineGeometry {
  return {
    kind: "line",
    points: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    ...overrides,
  };
}

describe("resolveLine", () => {
  it("moves a bonded end onto its location", () => {
    const resolved = resolveLine(line({ from: "oslo" }), index);

    expect(resolved.points[0]).toEqual([OSLO.lng, OSLO.lat]);
    // Only the end moved. The stored coordinates of everything between are the
    // shape of the line and are nobody else's business.
    expect(resolved.points[1]).toEqual([1, 1]);
    expect(resolved.points[2]).toEqual([2, 2]);
  });

  it("moves both ends when both are bonded", () => {
    const resolved = resolveLine(line({ from: "oslo", to: "bergen" }), index);

    expect(resolved.points[0]).toEqual([OSLO.lng, OSLO.lat]);
    expect(resolved.points[2]).toEqual([BERGEN.lng, BERGEN.lat]);
  });

  /**
   * The contract that means no cleanup pass is ever needed — the same one
   * `groupId` has. A dangling bond reads as "not bonded", so deleting a location
   * cannot strand a line and a half-failed write cannot corrupt one.
   */
  it("falls back to the stored point when the location is gone", () => {
    const resolved = resolveLine(line({ from: "deleted" }), index);

    expect(resolved.points[0]).toEqual([0, 0]);
  });

  it("keeps the bond on the geometry after resolving", () => {
    // Resolving is a read. If it dropped the id, the next pin move would have
    // nothing left to follow.
    expect(resolveLine(line({ from: "oslo" }), index).from).toBe("oslo");
  });

  it("returns an unbonded line untouched, by identity", () => {
    const plain = line();

    // Same object, not a copy: this runs on every redraw, for every shape, and
    // a fresh array per frame would be garbage for nothing.
    expect(resolveLine(plain, index)).toBe(plain);
  });

  it("leaves an empty line alone", () => {
    const empty = line({ points: [], from: "oslo" });

    expect(resolveLine(empty, index).points).toEqual([]);
  });

  it("does not write two ends onto a one-point line", () => {
    // A drawing abandoned after one click. Writing both ends of a
    // single-element array would silently drop `from` behind `to`.
    const single = line({ points: [[0, 0]], from: "oslo", to: "bergen" });
    const resolved = resolveLine(single, index);

    expect(resolved.points).toEqual([[OSLO.lng, OSLO.lat]]);
  });
});

describe("resolveGeometry", () => {
  it("passes an area through untouched", () => {
    const polygon = {
      kind: "polygon" as const,
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
      ] as [number, number][],
    };

    expect(resolveGeometry(polygon, index)).toBe(polygon);
  });

  it("resolves a line", () => {
    const resolved = resolveGeometry(line({ from: "bergen" }), index);

    expect(resolved.kind).toBe("line");
    expect(resolved.kind === "line" && resolved.points[0]).toEqual([
      BERGEN.lng,
      BERGEN.lat,
    ]);
  });
});

describe("resolveGeometry, on a routed line", () => {
  /**
   * The one case the rubber band must not fire on.
   *
   * A hand-drawn line's endpoint is a fallback and the pin is the truth, which
   * is what makes it follow a pin somebody drags. A route's points came out of a
   * routing engine and follow real roads: moving point 0 onto a pin two streets
   * away does not reroute anything, it draws a straight kink from the pin to
   * wherever the road geometry starts — on the canvas and in the published
   * snapshot alike. See lib/map/route-staleness.ts for what happens instead.
   */
  const routed = {
    kind: "line" as const,
    points: [
      [10.0, 60.0],
      [10.5, 60.2],
      [11.0, 60.4],
    ] as [number, number][],
    from: "bergen",
    route: {
      profile: "car" as const,
      stops: [{ at: [10.0, 60.0] as [number, number], placeId: "bergen" }],
      durationS: 900,
    },
  };

  it("returns it by reference, bond or no bond", () => {
    expect(resolveGeometry(routed, index)).toBe(routed);
  });

  it("leaves its first point exactly where the engine put it", () => {
    const resolved = resolveGeometry(routed, index);

    expect(resolved.kind === "line" && resolved.points[0]).toEqual([10.0, 60.0]);
  });

  it("still rubber-bands a hand-drawn line beside it", () => {
    const resolved = resolveGeometry(line({ from: "bergen" }), index);

    expect(resolved.kind === "line" && resolved.points[0]).toEqual([
      BERGEN.lng,
      BERGEN.lat,
    ]);
  });
});
