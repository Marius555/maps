import { describe, expect, it } from "vitest";

import {
  RoutingError,
  noSegmentIndex,
  toNearestResult,
  toRouteResult,
  type OsrmResponse,
} from "./osrm";

/**
 * The reader, not the transport.
 *
 * `route()` cannot be exercised without a network round trip, and mocking
 * `fetch` would only test the mock. Everything this adapter actually decides —
 * what counts as an answer, what counts as no route, what counts as a failure —
 * lives in this one pure function, which is the same split `formatLabel` and
 * `toAddressParts` make in the geocoder.
 */

function body(overrides: Partial<OsrmResponse> = {}): OsrmResponse {
  return {
    code: "Ok",
    routes: [
      {
        distance: 12_345.6,
        duration: 987.4,
        geometry: {
          type: "LineString",
          coordinates: [
            [25.28, 54.687],
            [25.29, 54.69],
            [25.3, 54.7],
          ],
        },
      },
    ],
    ...overrides,
  };
}

describe("toRouteResult", () => {
  it("reads the geometry, duration and distance of the first route", () => {
    const result = toRouteResult(body());

    expect(result).toEqual({
      route: {
        points: [
          [25.28, 54.687],
          [25.29, 54.69],
          [25.3, 54.7],
        ],
        durationS: 987,
        distanceM: 12_346,
      },
      unreachableStop: null,
    });
  });

  it("treats NoRoute as an answer, not a failure", () => {
    // The engine worked and there is no drivable way between the stops. The UI
    // says so; it does not show an error. Nothing is wrong with any one stop,
    // so there is no stop to name.
    expect(toRouteResult({ code: "NoRoute" })).toEqual({
      route: null,
      unreachableStop: null,
    });
  });

  it("carries the stop OSRM could not put on a road", () => {
    // The whole reason this is a pair and not a nullable result: the caller can
    // now say *which* location has no road near it.
    expect(
      toRouteResult({
        code: "NoSegment",
        message: "Could not find a matching segment for coordinate 2",
      }),
    ).toEqual({ route: null, unreachableStop: 2 });
  });

  it("still reads NoSegment as an answer when the message names nothing", () => {
    // A future OSRM wording, or a proxy that rewrote the body. The route is
    // still refused; the caller just falls back to the general message.
    expect(toRouteResult({ code: "NoSegment" })).toEqual({
      route: null,
      unreachableStop: null,
    });
  });

  it("throws when the engine refuses the question", () => {
    expect(() => toRouteResult({ code: "InvalidValue" })).toThrow(RoutingError);
  });

  it("returns no route for an empty or missing routes array", () => {
    expect(toRouteResult({ code: "Ok", routes: [] }).route).toBeNull();
    expect(toRouteResult({ code: "Ok" }).route).toBeNull();
  });

  it("returns null when the route came back with no usable geometry", () => {
    const oneCoordinate = body({
      routes: [
        {
          distance: 0,
          duration: 0,
          geometry: { type: "LineString", coordinates: [[25.28, 54.687]] },
        },
      ],
    });

    expect(toRouteResult(oneCoordinate).route).toBeNull();
  });

  it("drops malformed coordinate pairs rather than storing NaN", () => {
    const messy = body({
      routes: [
        {
          duration: 60,
          distance: 100,
          geometry: {
            type: "LineString",
            coordinates: [
              [25.28, 54.687],
              [Number.NaN, 54.69],
              [25.3],
              [25.31, 54.7],
            ],
          },
        },
      ],
    });

    expect(toRouteResult(messy).route?.points).toEqual([
      [25.28, 54.687],
      [25.31, 54.7],
    ]);
  });

  it("never reports a negative duration or distance", () => {
    const negative = body({
      routes: [
        {
          duration: -5,
          distance: -5,
          geometry: {
            type: "LineString",
            coordinates: [
              [25.28, 54.687],
              [25.3, 54.7],
            ],
          },
        },
      ],
    });

    expect(toRouteResult(negative).route).toMatchObject({
      durationS: 0,
      distanceM: 0,
    });
  });

  it("thins a path that would blow past the snapshot's point cap", () => {
    // 3,000 points with a real bend at each one — what `overview=full` returns
    // for anything longer than a town.
    const coordinates = Array.from({ length: 3000 }, (_, index) => [
      25 + index * 0.001,
      54.687 + (index % 2 === 0 ? 0 : 0.002),
    ]);

    const result = toRouteResult(
      body({
        routes: [
          {
            duration: 60,
            distance: 100,
            geometry: { type: "LineString", coordinates },
          },
        ],
      }),
    );

    expect(result.route?.points.length).toBeLessThanOrEqual(500);
    // Both ends survive, so the route still starts and finishes where it did.
    expect(result.route?.points[0]).toEqual([25, 54.687]);
  });
});

describe("noSegmentIndex", () => {
  it("reads the coordinate OSRM names", () => {
    expect(
      noSegmentIndex("Could not find a matching segment for coordinate 3"),
    ).toBe(3);
  });

  it("reads the first stop, which is index zero and not falsy", () => {
    // The one index a truthiness check would silently drop, and the commonest
    // one: the route starts at the pin with no road near it.
    expect(
      noSegmentIndex("Could not find a matching segment for coordinate 0"),
    ).toBe(0);
  });

  it("gives up on a message it does not recognise", () => {
    expect(noSegmentIndex("Impossible route between points")).toBeNull();
    expect(noSegmentIndex(undefined)).toBeNull();
    expect(noSegmentIndex("")).toBeNull();
  });

  it("does not mistake some other number in the sentence for the index", () => {
    // Anchored to the end, so only the integer that follows "coordinate" counts.
    expect(noSegmentIndex("2 of 5 coordinates failed")).toBeNull();
  });
});

describe("toNearestResult", () => {
  it("reports how far the point is from the road it would snap to", () => {
    expect(
      toNearestResult({ code: "Ok", waypoints: [{ distance: 18.4 }] }),
    ).toEqual({ snapM: 18 });
  });

  it("reads NoSegment as no road at all, not as a failure", () => {
    // The whole question this asks. A point with nothing to snap to is exactly
    // the pin the route tool must refuse.
    expect(toNearestResult({ code: "NoSegment" })).toBeNull();
  });

  it("returns null when the engine answered with no waypoint", () => {
    expect(toNearestResult({ code: "Ok" })).toBeNull();
    expect(toNearestResult({ code: "Ok", waypoints: [] })).toBeNull();
    expect(
      toNearestResult({ code: "Ok", waypoints: [{ distance: Number.NaN }] }),
    ).toBeNull();
  });

  it("throws when the engine refuses the question", () => {
    expect(() => toNearestResult({ code: "InvalidValue" })).toThrow(RoutingError);
  });
});
