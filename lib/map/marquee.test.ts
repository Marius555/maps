import { describe, expect, it } from "vitest";

import {
  boundsIntersectBox,
  boxFrom,
  isBoxUsable,
  isPointInBox,
  type SelectBox,
} from "./marquee";

const box: SelectBox = { x1: 100, y1: 100, x2: 200, y2: 200 };

describe("boxFrom", () => {
  it("normalises a drag made in any direction", () => {
    const downRight = boxFrom({ x: 10, y: 20 }, { x: 30, y: 40 });
    const upLeft = boxFrom({ x: 30, y: 40 }, { x: 10, y: 20 });

    expect(downRight).toEqual({ x1: 10, y1: 20, x2: 30, y2: 40 });
    expect(upLeft).toEqual(downRight);
  });
});

describe("isBoxUsable", () => {
  it("rejects a click, which is a deselect and not a selection", () => {
    expect(isBoxUsable(boxFrom({ x: 50, y: 50 }, { x: 51, y: 52 }))).toBe(false);
  });

  it("accepts a drag that moved in one axis only", () => {
    expect(isBoxUsable(boxFrom({ x: 50, y: 50 }, { x: 90, y: 51 }))).toBe(true);
  });
});

describe("isPointInBox", () => {
  it("takes a point inside", () => {
    expect(isPointInBox({ x: 150, y: 150 }, box)).toBe(true);
  });

  it("takes a point exactly on the edge", () => {
    expect(isPointInBox({ x: 100, y: 150 }, box)).toBe(true);
    expect(isPointInBox({ x: 200, y: 200 }, box)).toBe(true);
  });

  it("leaves a point outside", () => {
    expect(isPointInBox({ x: 99, y: 150 }, box)).toBe(false);
    expect(isPointInBox({ x: 150, y: 201 }, box)).toBe(false);
  });
});

describe("boundsIntersectBox", () => {
  it("takes a shape the box overlaps at a corner", () => {
    expect(
      boundsIntersectBox({ x1: 180, y1: 180, x2: 400, y2: 400 }, box),
    ).toBe(true);
  });

  it("takes a shape far bigger than the box", () => {
    // The case containment would get wrong: a two-kilometre radius cannot be
    // enclosed by a box drawn on a screen showing part of it.
    expect(
      boundsIntersectBox({ x1: -900, y1: -900, x2: 900, y2: 900 }, box),
    ).toBe(true);
  });

  it("takes a shape entirely inside the box", () => {
    expect(boundsIntersectBox({ x1: 120, y1: 120, x2: 140, y2: 140 }, box)).toBe(
      true,
    );
  });

  it("leaves a shape that only touches nothing", () => {
    expect(boundsIntersectBox({ x1: 201, y1: 100, x2: 300, y2: 200 }, box)).toBe(
      false,
    );
    expect(boundsIntersectBox({ x1: 100, y1: 0, x2: 200, y2: 99 }, box)).toBe(
      false,
    );
  });

  it("counts a shared edge as touching", () => {
    expect(boundsIntersectBox({ x1: 200, y1: 100, x2: 300, y2: 200 }, box)).toBe(
      true,
    );
  });
});
