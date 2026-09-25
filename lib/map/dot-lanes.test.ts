import { describe, expect, it } from "vitest";

import { dotInsetSize } from "@/packages/shared/dot-line";

import { dotLanes, type DotLine } from "./dot-lanes";

/** Metres to degrees near the equator, where the projection is ~1:1. */
const M = 1 / 111_320;

/** A straight east-west line at `y` metres north, from x0 to x1 metres. */
function east(
  id: string,
  x0: number,
  x1: number,
  y = 0,
  step = 50,
  stroke: DotLine["stroke"] = "dotted",
): DotLine {
  const points: [number, number][] = [];
  const direction = x1 >= x0 ? 1 : -1;
  for (let x = x0; direction * (x1 - x) > 0; x += direction * step) {
    points.push([x * M, y * M]);
  }
  points.push([x1 * M, y * M]);
  return { id, stroke, points, width: 4 };
}

function runsOf(runs: ReturnType<typeof dotLanes>, id: string) {
  return runs.filter((run) => run.id === id);
}

function lengthM(points: [number, number][]): number {
  let total = 0;
  for (let at = 1; at < points.length; at += 1) {
    total += Math.hypot(
      (points[at][0] - points[at - 1][0]) / M,
      (points[at][1] - points[at - 1][1]) / M,
    );
  }
  return total;
}

describe("dotLanes", () => {
  it("leaves a lone line as one run of its own points", () => {
    const line = east("a", 0, 500);
    const runs = dotLanes([line]);

    expect(runs).toEqual([
      { id: "a", stroke: "dotted", points: line.points, width: 4, lane: 0, lanes: 1 },
    ]);
  });

  it("leaves two lines far apart alone", () => {
    const runs = dotLanes([east("a", 0, 500), east("b", 0, 500, 200)]);

    expect(runs.every((run) => run.lanes === 1)).toBe(true);
    expect(runs).toHaveLength(2);
  });

  it("merges a shared stretch into two lanes on one geometry", () => {
    // a: 0..1000, b: 400..1400 — shared 400..1000.
    const runs = dotLanes([east("a", 0, 1000), east("b", 400, 1400)]);
    const shared = runs.filter((run) => run.lanes === 2);

    expect(shared).toHaveLength(2);
    expect(shared.map((run) => [run.id, run.lane])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    // The same array, which is what gives both the same anchors.
    expect(shared[0].points).toBe(shared[1].points);
    expect(lengthM(shared[0].points)).toBeCloseTo(600, 0);

    // Each still draws its own part alone.
    expect(lengthM(runsOf(runs, "a").find((run) => run.lanes === 1)!.points)).toBeCloseTo(400, 0);
    expect(lengthM(runsOf(runs, "b").find((run) => run.lanes === 1)!.points)).toBeCloseTo(400, 0);
  });

  it("holds back the first dot of a solo run that starts at a cut", () => {
    const runs = dotLanes([east("a", 0, 1000), east("b", 400, 1400)]);
    const aOwn = runsOf(runs, "a").find((run) => run.lanes === 1)!;
    const shared = runs.filter((run) => run.lanes === 2);
    const bOwn = runsOf(runs, "b").find((run) => run.lanes === 1)!;

    // a starts where a starts; b's tail starts at a cut.
    expect(aOwn.inset).toBeUndefined();
    expect(bOwn.inset).toBe(dotInsetSize(4));
    // The shared stretch places its own dots, half a pitch clear of each cut.
    expect(shared.map((run) => run.inset)).toEqual([undefined, undefined]);
  });

  it("merges dashed routes into lanes the same way, with no inset", () => {
    const runs = dotLanes([
      east("a", 0, 1000, 0, 50, "dashed"),
      east("b", 400, 1400, 0, 50, "dashed"),
    ]);
    const shared = runs.filter((run) => run.lanes === 2);

    expect(shared.map((run) => [run.id, run.lane, run.stroke])).toEqual([
      ["a", 0, "dashed"],
      ["b", 1, "dashed"],
    ]);
    expect(shared[0].points).toBe(shared[1].points);
    expect(runs.every((run) => run.inset === undefined)).toBe(true);
  });

  it("never merges a dotted route with a dashed one", () => {
    const runs = dotLanes([
      east("a", 0, 1000),
      east("b", 0, 1000, 0, 50, "dashed"),
    ]);

    expect(runs.every((run) => run.lanes === 1)).toBe(true);
    expect(runsOf(runs, "b")[0].stroke).toBe("dashed");
  });

  it("merges within tolerance and with different vertices", () => {
    const runs = dotLanes([east("a", 0, 1000), east("b", 0, 1000, 3, 37)]);

    expect(runs.filter((run) => run.lanes === 2)).toHaveLength(2);
    expect(runs.some((run) => run.lanes === 1)).toBe(false);
  });

  it("merges a route travelling the other way along the same road", () => {
    const runs = dotLanes([east("a", 0, 1000), east("b", 1000, 0)]);

    expect(runs.filter((run) => run.lanes === 2)).toHaveLength(2);
  });

  it("does not merge a crossing", () => {
    const a = east("a", 0, 1000);
    const b: DotLine = {
      id: "b",
      stroke: "dotted",
      points: [
        [500 * M, -500 * M],
        [500 * M, 500 * M],
      ],
      width: 4,
    };
    const runs = dotLanes([a, b]);

    expect(runs.every((run) => run.lanes === 1)).toBe(true);
    expect(runsOf(runs, "b")).toHaveLength(1);
  });

  it("alternates three routes on the stretch all three share", () => {
    const runs = dotLanes([
      east("a", 0, 1000),
      east("b", 0, 1000),
      east("c", 0, 1000),
    ]);

    expect(runs.map((run) => [run.id, run.lane, run.lanes])).toEqual([
      ["a", 0, 3],
      ["b", 1, 3],
      ["c", 2, 3],
    ]);
  });

  it("draws a route contained in another entirely on the leader's geometry", () => {
    const runs = dotLanes([east("a", 0, 1000), east("b", 200, 600)]);

    const b = runsOf(runs, "b");
    expect(b).toHaveLength(1);
    expect(b[0].lanes).toBe(2);
    expect(lengthM(b[0].points)).toBeCloseTo(400, 0);
    expect(runsOf(runs, "a")).toHaveLength(3);
  });

  it("gives every lane on a stretch the widest member's width", () => {
    const runs = dotLanes([
      east("a", 0, 1000),
      { ...east("b", 0, 1000), width: 8 },
    ]);

    expect(runs.map((run) => run.width)).toEqual([8, 8]);
  });
});
