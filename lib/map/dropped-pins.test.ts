import { beforeEach, describe, expect, it } from "vitest";

import { markDropped, resetDroppedPins, takeDropped } from "./dropped-pins";

describe("dropped pins", () => {
  beforeEach(() => {
    resetDroppedPins();
  });

  it("reports a location that was just dropped", () => {
    markDropped("place-1");

    expect(takeDropped("place-1")).toBe(true);
  });

  it("says nothing about a location nobody dropped", () => {
    expect(takeDropped("place-1")).toBe(false);
  });

  // The whole point: a marker rebuilt later — a category renamed, a style
  // swapped — must not replay the drop.
  it("forgets a mark once it has been claimed", () => {
    markDropped("place-1");
    takeDropped("place-1");

    expect(takeDropped("place-1")).toBe(false);
  });

  it("keeps marks apart", () => {
    markDropped("place-1");
    markDropped("place-2");

    expect(takeDropped("place-2")).toBe(true);
    expect(takeDropped("place-1")).toBe(true);
  });

  it("survives the same location being dropped twice", () => {
    markDropped("place-1");
    markDropped("place-1");

    expect(takeDropped("place-1")).toBe(true);
    expect(takeDropped("place-1")).toBe(false);
  });

  // Marks are claimed within a frame in practice; an unclaimed one is an
  // editor that unmounted mid-create, and those must not accumulate for the
  // life of the tab.
  it("drops the oldest unclaimed marks rather than growing without bound", () => {
    for (let i = 0; i < 100; i += 1) markDropped(`place-${i}`);

    expect(takeDropped("place-0")).toBe(false);
    expect(takeDropped("place-99")).toBe(true);
  });
});
