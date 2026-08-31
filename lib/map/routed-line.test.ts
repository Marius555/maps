import { describe, expect, it } from "vitest";

import type { RouteResult } from "@/lib/routing/types";
import type { RouteStop } from "@/packages/shared/shapes";
import { toRoutedLine } from "./routed-line";

const RESULT: RouteResult = {
  points: [
    [25.28, 54.687],
    [25.29, 54.693],
    [25.3, 54.7],
  ],
  durationS: 900,
  distanceM: 12_000,
};

describe("toRoutedLine", () => {
  it("keeps the engine's points and our stops side by side", () => {
    const stops: RouteStop[] = [
      { at: [25.28, 54.687], placeId: "depot" },
      { at: [25.3, 54.7], placeId: "shop" },
    ];

    const line = toRoutedLine(stops, "car", RESULT);

    expect(line.points).toEqual(RESULT.points);
    expect(line.route?.stops).toEqual(stops);
    expect(line.route?.durationS).toBe(900);
    expect(line.route?.profile).toBe("car");
  });

  it("derives from and to from the end stops", () => {
    // Not redundant with `stops`: every existing reader of a line knows about
    // these two and nothing about routes, which is what lets a route be an
    // ordinary line everywhere else in the app.
    const line = toRoutedLine(
      [
        { at: [25.28, 54.687], placeId: "depot" },
        { at: [25.29, 54.69] },
        { at: [25.3, 54.7], placeId: "shop" },
      ],
      "car",
      RESULT,
    );

    expect(line.from).toBe("depot");
    expect(line.to).toBe("shop");
  });

  it("leaves them absent when the ends are free waypoints", () => {
    const line = toRoutedLine([{ at: [1, 1] }, { at: [2, 2] }], "car", RESULT);

    expect("from" in line).toBe(false);
    expect("to" in line).toBe(false);
  });

  it("bonds one end without inventing the other", () => {
    const line = toRoutedLine(
      [{ at: [1, 1], placeId: "depot" }, { at: [2, 2] }],
      "car",
      RESULT,
    );

    expect(line.from).toBe("depot");
    expect("to" in line).toBe(false);
  });

  it("copies the stops rather than holding the caller's array", () => {
    const stops: RouteStop[] = [{ at: [1, 1] }, { at: [2, 2] }];
    const line = toRoutedLine(stops, "car", RESULT);

    stops.push({ at: [3, 3] });

    expect(line.route?.stops).toHaveLength(2);
  });
});
