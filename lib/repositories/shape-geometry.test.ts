import { describe, expect, it } from "vitest";

import type { ShapeGeometry } from "@/packages/shared/shapes";
import { toShapeColumns, toShapeGeometry } from "./shape-geometry";

/**
 * What actually reaches the `geometry` column.
 *
 * Every branch of `toShapeColumns` is a whitelist, which is right — the column is
 * JSON and anything spread into it is stored forever with nothing to reject it.
 * The cost is that a field added to a geometry type and not added here is
 * written away in silence: it type-checks, it saves, and it reads back missing,
 * where it looks like a rendering bug rather than a storage one. That is exactly
 * how routes were lost the first time they were drawn.
 */
describe("toShapeColumns", () => {
  it("splits a circle into its kind and its payload", () => {
    const geometry: ShapeGeometry = {
      kind: "circle",
      lng: 25.28,
      lat: 54.687,
      radius: 2400,
    };

    expect(toShapeColumns(geometry)).toEqual({
      kind: "circle",
      geometry: JSON.stringify({ lng: 25.28, lat: 54.687, radius: 2400 }),
    });
  });

  it("keeps a line's bonds beside its points", () => {
    // Without them a bonded end is a stale coordinate that stops following its
    // pin the moment the page reloads.
    const geometry: ShapeGeometry = {
      kind: "line",
      points: [
        [1, 1],
        [2, 2],
      ],
      from: "depot",
      to: "shop",
    };

    expect(JSON.parse(toShapeColumns(geometry).geometry)).toEqual({
      points: [
        [1, 1],
        [2, 2],
      ],
      from: "depot",
      to: "shop",
    });
  });

  it("omits bonds that were never set", () => {
    const geometry: ShapeGeometry = {
      kind: "line",
      points: [
        [1, 1],
        [2, 2],
      ],
    };

    expect(JSON.parse(toShapeColumns(geometry).geometry)).toEqual({
      points: [
        [1, 1],
        [2, 2],
      ],
    });
  });

  it("stores a route's stops, profile and duration", () => {
    // The stops are the engine's input. A line that loses them can never be
    // recalculated, and is a route only until the page reloads.
    const route = {
      profile: "car" as const,
      stops: [{ at: [1, 1] as [number, number], placeId: "depot" }, { at: [2, 2] as [number, number] }],
      durationS: 900,
    };

    const geometry: ShapeGeometry = {
      kind: "line",
      points: [
        [1, 1],
        [1.5, 1.5],
        [2, 2],
      ],
      from: "depot",
      route,
    };

    expect(JSON.parse(toShapeColumns(geometry).geometry).route).toEqual(route);
  });

  it("stores a route as a line, not as a kind of its own", () => {
    // A route is not a `ShapeKind`. Making it one would earn it a fill layer, an
    // Appwrite enum value and a second branch in every switch that reads
    // geometry.
    const geometry: ShapeGeometry = {
      kind: "line",
      points: [
        [1, 1],
        [2, 2],
      ],
      route: { profile: "car", stops: [{ at: [1, 1] }, { at: [2, 2] }], durationS: 60 },
    };

    expect(toShapeColumns(geometry).kind).toBe("line");
  });

  it("writes a polygon's points and nothing else", () => {
    const geometry: ShapeGeometry = {
      kind: "polygon",
      points: [
        [1, 1],
        [2, 2],
        [3, 1],
      ],
    };

    expect(Object.keys(JSON.parse(toShapeColumns(geometry).geometry))).toEqual(["points"]);
  });
});

/**
 * The read direction, and the round trip that is the point of both.
 *
 * A row's `geometry` is JSON we wrote ourselves, so the interesting cases are
 * the ones where we did not: a row written before a field existed, and a row
 * that is not readable at all.
 */
describe("toShapeGeometry", () => {
  const row = (kind: string, geometry: unknown) =>
    ({ kind, geometry: JSON.stringify(geometry) }) as never;

  it("survives a round trip with a route intact", () => {
    // The one that matters: this is the trip that silently lost a route's stops.
    const geometry: ShapeGeometry = {
      kind: "line",
      points: [
        [1, 1],
        [1.5, 1.5],
        [2, 2],
      ],
      from: "depot",
      route: {
        profile: "car",
        stops: [{ at: [1, 1], placeId: "depot" }, { at: [2, 2] }],
        durationS: 900,
      },
    };

    const columns = toShapeColumns(geometry);

    expect(
      toShapeGeometry({ kind: columns.kind, geometry: columns.geometry } as never),
    ).toEqual(geometry);
  });

  it("reads a line written before routes existed as a hand-drawn one", () => {
    const parsed = toShapeGeometry(
      row("line", { points: [[1, 1], [2, 2]], from: "depot" }),
    );

    expect(parsed).toEqual({
      kind: "line",
      points: [
        [1, 1],
        [2, 2],
      ],
      from: "depot",
    });
  });

  it("decodes a line as a line, never as a radius-zero circle", () => {
    // The fall-through is a circle, so a missing branch here makes a line vanish
    // from the map with nothing anywhere reporting an error.
    expect(toShapeGeometry(row("line", { points: [[1, 1], [2, 2]] })).kind).toBe(
      "line",
    );
  });

  it("never throws on an unreadable row", () => {
    // One bad row must not take a whole map's shape list down with it.
    const broken = { kind: "line", geometry: "{not json" } as never;

    expect(toShapeGeometry(broken)).toEqual({ kind: "line", points: [] });
  });

  it("drops an empty bond rather than storing it as an empty string", () => {
    const parsed = toShapeGeometry(row("line", { points: [[1, 1], [2, 2]], from: "" }));

    expect(parsed).not.toHaveProperty("from");
  });
});
