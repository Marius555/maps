import { describe, expect, it } from "vitest";

import type { LngLatTuple } from "@/packages/shared/shapes";
import { douglasPeucker, simplifyPath } from "./simplify";

/** A straight run east, `count` points, about 7m apart at this latitude. */
function straight(count: number): LngLatTuple[] {
  return Array.from({ length: count }, (_, index): LngLatTuple => [
    25 + index * 0.0001,
    54.687,
  ]);
}

/** A path that genuinely bends: a sawtooth `count` points long. */
function zigzag(count: number, amplitude: number): LngLatTuple[] {
  return Array.from({ length: count }, (_, index): LngLatTuple => [
    25 + index * 0.001,
    54.687 + (index % 2 === 0 ? 0 : amplitude),
  ]);
}

describe("simplifyPath", () => {
  it("returns a path already under the cap untouched", () => {
    const points = zigzag(50, 0.01);

    expect(simplifyPath(points, 500)).toEqual(points);
  });

  it("fits a long path inside the cap", () => {
    // A real bend at every point, so nothing is removable at the starting
    // tolerance and the doubling has to do the work.
    const points = zigzag(3000, 0.002);
    const result = simplifyPath(points, 500);

    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.length).toBeGreaterThan(1);
  });

  it("never moves either endpoint", () => {
    const points = zigzag(3000, 0.002);
    const result = simplifyPath(points, 500);

    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });

  it("collapses a straight run to its two ends", () => {
    // The point of the whole exercise: a motorway sampled every few metres is
    // hundreds of coordinates saying nothing, and that is what a route mostly is.
    expect(simplifyPath(straight(600), 500)).toHaveLength(2);
  });

  it("keeps a two-point path as it is", () => {
    const points = straight(2);

    expect(simplifyPath(points, 1)).toEqual(points);
  });
});

describe("douglasPeucker", () => {
  it("keeps a corner that is further off the chord than the tolerance", () => {
    // ~1.1km off the straight line between the ends — well past any tolerance
    // the simplifier starts at.
    const points: LngLatTuple[] = [
      [25, 54.687],
      [25.001, 54.697],
      [25.002, 54.687],
    ];

    expect(douglasPeucker(points, 5)).toHaveLength(3);
  });

  it("drops a point that sits on the line between its neighbours", () => {
    const points: LngLatTuple[] = [
      [25, 54.687],
      [25.001, 54.687],
      [25.002, 54.687],
    ];

    expect(douglasPeucker(points, 5)).toEqual([points[0], points[2]]);
  });

  it("handles a path that doubles back on itself", () => {
    // Start and end at the same point: the chord has zero length, which is the
    // one case the perpendicular distance is undefined for.
    const points: LngLatTuple[] = [
      [25, 54.687],
      [25.01, 54.687],
      [25, 54.687],
    ];

    expect(douglasPeucker(points, 5)).toHaveLength(3);
  });
});
