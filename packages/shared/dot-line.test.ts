import { describe, expect, it } from "vitest";

import {
  DOT_IMAGE_SIZE,
  DOT_MIN_SPACING_PX,
  DOT_SPACING_RATIO,
  DOT_WIDTH_BUCKETS,
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
