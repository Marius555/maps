import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  addKey,
  emptySketch,
  estimate,
  mergeSketch,
  sketchFromString,
  sketchToString,
} from "./hll";

/**
 * The unique-visitor estimate. Every visitor figure on the Analytics page is
 * one of these, merged across days, so the properties that matter are: close
 * to the truth, exact-ish when small, and a merge that is a union.
 */

/** A key shaped like the ones visitor-key.ts mints. */
function key(index: number): string {
  return createHash("sha256")
    .update(`visitor-${String(index)}`)
    .digest("hex")
    .slice(0, 16);
}

function sketchOf(from: number, to: number) {
  const sketch = emptySketch();
  for (let index = from; index < to; index += 1) addKey(sketch, key(index));
  return sketch;
}

describe("estimate", () => {
  it("is zero for nothing", () => {
    expect(estimate(emptySketch())).toBe(0);
  });

  it("is exact for a handful", () => {
    // Where nearly every map on this product lives.
    for (const count of [1, 2, 5, 12]) {
      expect(estimate(sketchOf(0, count)), String(count)).toBe(count);
    }
  });

  it("counts a key added twice once", () => {
    const sketch = sketchOf(0, 50);
    for (let index = 0; index < 50; index += 1) addKey(sketch, key(index));

    expect(estimate(sketch)).toBe(estimate(sketchOf(0, 50)));
  });

  it("stays within 5% at a hundred and at ten thousand", () => {
    for (const count of [100, 10_000]) {
      const error = Math.abs(estimate(sketchOf(0, count)) - count) / count;
      expect(error, String(count)).toBeLessThan(0.05);
    }
  });

  it("ignores anything that is not a visitor key", () => {
    const sketch = emptySketch();
    addKey(sketch, "not-a-key");
    addKey(sketch, "");

    expect(estimate(sketch)).toBe(0);
  });
});

describe("mergeSketch", () => {
  it("is a union, not a sum", () => {
    // Visitors 0–599 on one day and 400–999 on the next are 1,000 people.
    const monday = sketchOf(0, 600);
    mergeSketch(monday, sketchOf(400, 1_000));

    expect(estimate(monday)).toBe(estimate(sketchOf(0, 1_000)));
  });
});

describe("storage", () => {
  it("round-trips through a string", () => {
    const sketch = sketchOf(0, 300);

    expect(sketchFromString(sketchToString(sketch))).toEqual(sketch);
  });

  it("reads anything else as empty rather than throwing", () => {
    for (const value of [
      undefined,
      null,
      42,
      "",
      "!!!not base64!!!",
      btoa("short"),
    ]) {
      expect(estimate(sketchFromString(value))).toBe(0);
    }
  });
});
