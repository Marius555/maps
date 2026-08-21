import { describe, expect, it } from "vitest";

import type { LngLatTuple } from "@/packages/shared/shapes";
import {
  edgeMidpointAt,
  edgeMidpoints,
  insertPointAt,
  translatePoints,
} from "./polygon-edit";

/** A unit square, so every midpoint is a whole or half number to read at a glance. */
const SQUARE: LngLatTuple[] = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
];

describe("edgeMidpoints", () => {
  it("gives one per edge, including the edge that closes the ring", () => {
    expect(edgeMidpoints(SQUARE)).toEqual([
      { lng: 1, lat: 0 },
      { lng: 2, lat: 1 },
      { lng: 1, lat: 2 },
      // The closing edge, from the last corner back to the first. This is the
      // one nobody clicked, so it is the one most likely to want a point.
      { lng: 0, lat: 1 },
    ]);
  });

  it("gives a triangle three", () => {
    const triangle: LngLatTuple[] = [
      [0, 0],
      [4, 0],
      [0, 4],
    ];

    expect(edgeMidpoints(triangle)).toHaveLength(3);
  });

  it("has nothing to offer a ring with no edges", () => {
    expect(edgeMidpoints([])).toEqual([]);
    expect(edgeMidpoints([[1, 1]])).toEqual([]);
  });
});

describe("edgeMidpointAt", () => {
  it("agrees with the whole-ring form, edge for edge", () => {
    // The single-edge form is what a handle calls on every pointer sample while a
    // neighbouring corner is dragged. If the two ever disagreed, a midpoint would
    // sit where it was built rather than where its edge now is.
    const all = edgeMidpoints(SQUARE);

    for (let index = 0; index < SQUARE.length; index += 1) {
      expect(edgeMidpointAt(SQUARE, index)).toEqual(all[index]);
    }
  });

  it("wraps at the last corner, back to the first", () => {
    expect(edgeMidpointAt(SQUARE, SQUARE.length - 1)).toEqual({ lng: 0, lat: 1 });
  });

  it("follows a corner that has moved", () => {
    // What a vertex drag looks like from a midpoint's side: the corner it shares
    // an edge with is somewhere else, so it is too.
    const moved: LngLatTuple[] = [[0, 0], [4, 0], [2, 2], [0, 2]];

    expect(edgeMidpointAt(moved, 0)).toEqual({ lng: 2, lat: 0 });
  });

  it("has no answer for a ring with no edges", () => {
    expect(edgeMidpointAt([], 0)).toBeNull();
    expect(edgeMidpointAt([[1, 1]], 0)).toBeNull();
    expect(edgeMidpointAt(SQUARE, 99)).toBeNull();
  });
});

describe("insertPointAt", () => {
  it("puts the point where the index says, pushing the rest along", () => {
    // The midpoint of edge 0 inserts at 1: between the corners it lies between.
    expect(insertPointAt(SQUARE, 1, [1, 0])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
  });

  it("appends for the closing edge", () => {
    // Its midpoint is between the last corner and the first, which as an open
    // ring means the very end.
    expect(insertPointAt(SQUARE, SQUARE.length, [0, 1])).toEqual([
      ...SQUARE,
      [0, 1],
    ]);
  });

  it("clamps an index that is off either end rather than tearing a hole", () => {
    expect(insertPointAt(SQUARE, 99, [9, 9])).toHaveLength(5);
    expect(insertPointAt(SQUARE, -3, [9, 9])[0]).toEqual([9, 9]);
  });

  it("leaves the ring it was handed alone", () => {
    const before = [...SQUARE];
    insertPointAt(SQUARE, 2, [5, 5]);

    expect(SQUARE).toEqual(before);
  });
});

describe("translatePoints", () => {
  it("moves every corner by the same amount", () => {
    expect(translatePoints(SQUARE, 0.5, -1)).toEqual([
      [0.5, -1],
      [2.5, -1],
      [2.5, 1],
      [0.5, 1],
    ]);
  });

  it("keeps the shape's form — every edge is the length it was", () => {
    const moved = translatePoints(SQUARE, 10, 10);

    for (let index = 0; index < SQUARE.length; index += 1) {
      const next = (index + 1) % SQUARE.length;

      expect(
        Math.hypot(
          moved[next][0] - moved[index][0],
          moved[next][1] - moved[index][1],
        ),
      ).toBeCloseTo(
        Math.hypot(
          SQUARE[next][0] - SQUARE[index][0],
          SQUARE[next][1] - SQUARE[index][1],
        ),
      );
    }
  });
});
