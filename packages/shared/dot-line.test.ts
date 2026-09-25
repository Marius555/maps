import { describe, expect, it } from "vitest";

import {
  DASH_ARRAY,
  DASH_ARRAY_EXPRESSION,
  DOT_IMAGE_SIZE,
  DOT_MIN_SPACING_PX,
  DOT_SPACING_RATIO,
  DOT_WIDTH_BUCKETS,
  dashLanePattern,
  dotImage,
  dotLayerId,
  dotSpacingFor,
  dotWidthFilter,
} from "./dot-line";
import {
  DEFAULT_AREA_STROKE_WIDTH,
  DEFAULT_LINE_STROKE_WIDTH,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
} from "./shapes";

describe("dotSpacingFor", () => {
  it("follows the stroke, which is the whole point of the change", () => {
    expect(dotSpacingFor(4)).toBe(4 * DOT_SPACING_RATIO);
    expect(dotSpacingFor(12)).toBe(12 * DOT_SPACING_RATIO);
  });

  it("leaves a gap, never a solid line", () => {
    // The dot's diameter is the stroke width, so spacing must exceed it or the
    // dots touch and the marking stops being a marking.
    for (const width of DOT_WIDTH_BUCKETS) {
      expect(dotSpacingFor(width)).toBeGreaterThan(width);
    }
  });

  it("floors a hairline, so a long route is not tens of thousands of icons", () => {
    expect(dotSpacingFor(MIN_STROKE_WIDTH)).toBe(DOT_MIN_SPACING_PX);
    expect(dotSpacingFor(2)).toBe(DOT_MIN_SPACING_PX);
  });

  it("draws both defaults tighter than the flat 14px it replaced", () => {
    expect(dotSpacingFor(DEFAULT_LINE_STROKE_WIDTH)).toBeLessThan(14);
    expect(dotSpacingFor(DEFAULT_AREA_STROKE_WIDTH)).toBeLessThan(14);
  });
});

describe("DOT_WIDTH_BUCKETS", () => {
  it("covers every width the control offers, exactly once", () => {
    expect(DOT_WIDTH_BUCKETS).toHaveLength(
      MAX_STROKE_WIDTH - MIN_STROKE_WIDTH + 1,
    );
    expect(DOT_WIDTH_BUCKETS[0]).toBe(MIN_STROKE_WIDTH);
    expect(DOT_WIDTH_BUCKETS.at(-1)).toBe(MAX_STROKE_WIDTH);
    expect(new Set(DOT_WIDTH_BUCKETS).size).toBe(DOT_WIDTH_BUCKETS.length);
  });

  it("gives every bucket its own layer id", () => {
    const ids = DOT_WIDTH_BUCKETS.map((width) => dotLayerId("dots", width));

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("dots-1");
  });
});

describe("dotWidthFilter", () => {
  /** What MapLibre would do with the expression, for the cases that matter. */
  const matches = (filterWidth: number, featureWidth: number) => {
    const [, expression, want] = dotWidthFilter(filterWidth);
    const [, max, [, min, [, ,]]] = expression;

    return Math.min(max, Math.max(min, Math.round(featureWidth))) === want;
  };

  it("puts each width on its own layer", () => {
    expect(matches(4, 4)).toBe(true);
    expect(matches(4, 5)).toBe(false);
  });

  it("lands an out-of-range legacy row on a layer rather than nowhere", () => {
    // An unmatched feature is a dotted shape that draws nothing at all, which
    // reads as a shape somebody deleted.
    expect(matches(MIN_STROKE_WIDTH, 0.4)).toBe(true);
    expect(matches(MAX_STROKE_WIDTH, 99)).toBe(true);
    expect(matches(3, 2.6)).toBe(true);
  });
});

describe("dotImage", () => {
  it("is a square SDF disc carried entirely in the alpha channel", () => {
    const image = dotImage();

    expect(image.width).toBe(DOT_IMAGE_SIZE);
    expect(image.height).toBe(DOT_IMAGE_SIZE);

    const centre =
      ((DOT_IMAGE_SIZE / 2) * DOT_IMAGE_SIZE + DOT_IMAGE_SIZE / 2) * 4;

    expect(image.data[centre]).toBe(0);
    expect(image.data[centre + 3]).toBe(255);
    // A corner is outside the disc entirely.
    expect(image.data[3]).toBe(0);
  });
});

describe("dashLanePattern", () => {
  /** Where a pattern's dashes start and end along one period, in widths. */
  const dashes = (pattern: number[]) => {
    const out: [number, number][] = [];
    let at = 0;
    pattern.forEach((length, index) => {
      if (index % 2 === 0 && length > 0) out.push([at, at + length]);
      at += length;
    });
    return out;
  };

  const period = DASH_ARRAY[0] + DASH_ARRAY[1];

  it("stretches the period by the number of lanes", () => {
    for (let lanes = 2; lanes <= 3; lanes += 1) {
      for (let lane = 0; lane < lanes; lane += 1) {
        const total = dashLanePattern(lane, lanes).reduce((a, b) => a + b, 0);
        expect(total).toBe(period * lanes);
      }
    }
  });

  it("gives each lane one dash, a whole period after the lane before", () => {
    expect(dashes(dashLanePattern(0, 3))).toEqual([[0, 2]]);
    expect(dashes(dashLanePattern(1, 3))).toEqual([[4, 6]]);
    expect(dashes(dashLanePattern(2, 3))).toEqual([[8, 10]]);
  });

  it("together draws the ordinary dashed line", () => {
    const all = [0, 1]
      .flatMap((lane) => dashes(dashLanePattern(lane, 2)))
      .sort((a, b) => a[0] - b[0]);

    expect(all).toEqual([
      [0, 2],
      [4, 6],
    ]);
  });

  it("falls through to the plain pattern for a shape that shares nothing", () => {
    expect(DASH_ARRAY_EXPRESSION.at(-1)).toEqual(["literal", DASH_ARRAY]);
    // Every lane of two and of three, and nothing for one lane of one.
    const labels = DASH_ARRAY_EXPRESSION.slice(2, -1).filter(
      (_, index) => index % 2 === 0,
    );
    expect(labels).toEqual(["02", "12", "03", "13", "23"]);
  });
});
