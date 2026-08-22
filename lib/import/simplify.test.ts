import { describe, expect, it } from "vitest";

import { simplifyToFit } from "./simplify";
import type { LngLatTuple } from "@/packages/shared/shapes";

/** A ring of `count` points around a circle — a stand-in for a real boundary. */
function ring(count: number, radiusDeg = 1): LngLatTuple[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * 2 * Math.PI;
    return [
      Math.cos(angle) * radiusDeg,
      Math.sin(angle) * radiusDeg,
    ] as LngLatTuple;
  });
}

describe("simplifyToFit", () => {
  it("leaves a ring that already fits completely alone", () => {
    const small = ring(20);
    const result = simplifyToFit(small, 500);

    expect(result.simplified).toBe(false);
    expect(result.points).toEqual(small);
    expect(result.before).toBe(20);
  });

  it("brings a real-sized boundary under the cap", () => {
    // Roughly Nunavut's vertex count, which is the case that makes this
    // mandatory rather than nice: without it the import simply fails.
    const huge = ring(6841);
    const result = simplifyToFit(huge, 500);

    expect(result.simplified).toBe(true);
    expect(result.before).toBe(6841);
    expect(result.points.length).toBeLessThanOrEqual(500);
  });

  it("keeps the first and last points", () => {
    const huge = ring(4000);
    const result = simplifyToFit(huge, 100);

    expect(result.points[0]).toEqual(huge[0]);
    expect(result.points[result.points.length - 1]).toEqual(huge[huge.length - 1]);
  });

  it("keeps the shape recognisable rather than truncating it", () => {
    const huge = ring(3000, 1);
    const result = simplifyToFit(huge, 50);

    /*
     * The failure this guards against is returning the first N points, which
     * would leave one arc of the circle rather than the circle. Every quadrant
     * has to still be represented.
     */
    const quadrants = new Set(
      result.points.map(([lng, lat]) => `${lng >= 0 ? "e" : "w"}${lat >= 0 ? "n" : "s"}`),
    );

    expect(quadrants.size).toBe(4);
  });

  it("collapses a straight run to its endpoints", () => {
    // Every interior point lies exactly on the line, so all of them are noise.
    const straight: LngLatTuple[] = Array.from(
      { length: 200 },
      (_, index) => [index * 0.001, 0] as LngLatTuple,
    );

    const result = simplifyToFit(straight, 50);

    expect(result.points).toEqual([straight[0], straight[199]]);
  });

  it("keeps a corner that a straight run turns through", () => {
    const bent: LngLatTuple[] = [
      ...Array.from({ length: 100 }, (_, i) => [i * 0.001, 0] as LngLatTuple),
      ...Array.from({ length: 100 }, (_, i) => [0.099, i * 0.001] as LngLatTuple),
    ];

    const result = simplifyToFit(bent, 10);

    // Three points minimum: both ends and the corner. Losing the corner would
    // turn an L into a diagonal.
    expect(result.points.length).toBeGreaterThanOrEqual(3);
    expect(result.points.some(([lng, lat]) => lng === 0.099 && lat === 0)).toBe(true);
  });

  it("collapses a degenerate ring to its endpoints", () => {
    // Every point in the same place. The first pass already finds nothing worth
    // keeping between them, so this needs no special handling at all — which is
    // why there is no "gave up" branch in the implementation.
    const degenerate: LngLatTuple[] = Array.from(
      { length: 2000 },
      () => [5, 5] as LngLatTuple,
    );

    const result = simplifyToFit(degenerate, 100);

    expect(result.points).toEqual([
      [5, 5],
      [5, 5],
    ]);
    expect(result.simplified).toBe(true);
  });

  it("always lands under the cap, however small", () => {
    // The loop's own guarantee: a big enough tolerance keeps only the two
    // endpoints, so any cap of two or more is reachable.
    for (const cap of [2, 3, 10, 499]) {
      expect(simplifyToFit(ring(6841), cap).points.length).toBeLessThanOrEqual(cap);
    }
  });

  it("refuses to pretend a cap under two points is a path", () => {
    expect(simplifyToFit(ring(500), 1).points).toHaveLength(1);
    expect(simplifyToFit(ring(500), 0).points).toHaveLength(0);
  });

  it("handles rings too short to simplify", () => {
    expect(simplifyToFit([], 500).points).toEqual([]);
    expect(simplifyToFit([[0, 0]], 500).points).toEqual([[0, 0]]);
  });
});
