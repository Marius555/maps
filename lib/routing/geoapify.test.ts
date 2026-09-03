import { describe, expect, it } from "vitest";

import {
  flattenLegs,
  toNearestResult,
  toRouteResult,
  type GeoapifyRouteResponse,
} from "./geoapify";

/**
 * The reader, not the transport.
 *
 * Same split as osrm.test.ts: `route()` cannot be exercised without a network
 * round trip, and mocking `fetch` would only test the mock. What this adapter
 * decides — how legs become one line, which field is the drive time, what counts
 * as no route — is all in these three pure functions.
 */

function body(overrides: Partial<GeoapifyRouteResponse> = {}): GeoapifyRouteResponse {
  return {
    features: [
      {
        properties: { distance: 12_345.6, time: 987.4 },
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [25.28, 54.687],
              [25.29, 54.69],
            ],
            [
              [25.29, 54.69],
              [25.3, 54.7],
            ],
          ],
        },
      },
    ],
    ...overrides,
  };
}

describe("flattenLegs", () => {
  it("joins consecutive legs and drops the coordinate they share", () => {
    const points = flattenLegs([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [1, 1],
        [2, 2],
      ],
      [
        [2, 2],
        [3, 3],
      ],
    ]);

    expect(points).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("accepts a plain LineString, so a single-leg route is not silently empty", () => {
    expect(
      flattenLegs([
        [0, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  /*
   * A real discontinuity between legs is kept. Closing it would draw a straight
   * line across the gap and publish it as a road.
   */
  it("keeps a gap between legs that do not actually meet", () => {
    const points = flattenLegs([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [1.5, 1.5],
        [2, 2],
      ],
    ]);

    expect(points).toHaveLength(4);
  });

  it("skips malformed pairs rather than emitting NaN coordinates", () => {
    const points = flattenLegs([
      [[0, 0], [Number.NaN, 1], [2], [3, 3]] as number[][],
    ]);

    expect(points).toEqual([
      [0, 0],
      [3, 3],
    ]);
  });

  it("has nothing to say about an absent geometry", () => {
    expect(flattenLegs(undefined)).toEqual([]);
    expect(flattenLegs([])).toEqual([]);
  });
});

describe("toRouteResult", () => {
  it("reads the drive time from `time` and the length from `distance`", () => {
    const outcome = toRouteResult(body());

    expect(outcome.route?.durationS).toBe(987);
    expect(outcome.route?.distanceM).toBe(12_346);
  });

  it("returns one continuous line across the legs", () => {
    expect(toRouteResult(body()).route?.points).toEqual([
      [25.28, 54.687],
      [25.29, 54.69],
      [25.3, 54.7],
    ]);
  });

  /*
   * Geoapify names no unreachable stop — OSRM's `NoSegment` prose has no
   * counterpart. The caller falls back to a message about the route, and the
   * routability probe is what prevents the case in the first place.
   */
  it("never names an unreachable stop", () => {
    expect(toRouteResult(body()).unreachableStop).toBeNull();
    expect(toRouteResult({}).unreachableStop).toBeNull();
  });

  it("treats an answer with no features as no route", () => {
    expect(toRouteResult({}).route).toBeNull();
    expect(toRouteResult({ features: [] }).route).toBeNull();
  });

  it("refuses a route whose geometry is a single point", () => {
    const outcome = toRouteResult(
      body({
        features: [
          {
            properties: { distance: 0, time: 0 },
            geometry: { type: "MultiLineString", coordinates: [[[25.28, 54.687]]] },
          },
        ],
      }),
    );

    expect(outcome.route).toBeNull();
  });

  it("never reports a negative duration or distance", () => {
    const outcome = toRouteResult(
      body({
        features: [
          {
            properties: { distance: -5, time: -5 },
            geometry: {
              type: "LineString",
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        ],
      }),
    );

    expect(outcome.route?.durationS).toBe(0);
    expect(outcome.route?.distanceM).toBe(0);
  });
});

describe("toNearestResult", () => {
  it("reads the metres to the nearest street", () => {
    expect(
      toNearestResult({ features: [{ properties: { distance: 42.6 } }] }),
    ).toEqual({ snapM: 43 });
  });

  /* No street within reach is the ordinary answer for a pin in a field. */
  it("answers null when nothing was found", () => {
    expect(toNearestResult({ features: [] })).toBeNull();
    expect(toNearestResult({})).toBeNull();
    expect(toNearestResult({ features: [{ properties: {} }] })).toBeNull();
  });
});
