import { describe, expect, it } from "vitest";

import {
  nearestDelta,
  panelDelta,
  pickBestDelta,
  project,
  scrollAt,
} from "./reveal-fold";

/** A panel box, with the fields a case does not care about filled in. */
function box(
  values: Partial<{
    top: number;
    bottom: number;
    height: number;
    finalHeight: number | null;
  }> = {},
) {
  const height = values.height ?? 0;
  const top = values.top ?? 0;

  return {
    top,
    bottom: values.bottom ?? top + height,
    height,
    finalHeight: values.finalHeight === undefined ? null : values.finalHeight,
  };
}

describe("panelDelta", () => {
  it("is zero for a settled open panel", () => {
    // React Aria writes `auto` back once the opening animation finishes.
    expect(panelDelta(box({ height: 180, finalHeight: null }))).toBe(0);
  });

  it("is zero for a panel that has never been opened", () => {
    // The other settled state: `0px` inline against a zero-height box.
    expect(panelDelta(box({ height: 0, finalHeight: 0 }))).toBe(0);
  });

  it("is the growth still to come while a panel opens", () => {
    expect(panelDelta(box({ height: 8, finalHeight: 180 }))).toBe(172);
  });

  it("is negative while a panel closes", () => {
    expect(panelDelta(box({ height: 180, finalHeight: 0 }))).toBe(-180);
  });
});

describe("project", () => {
  it("grows the item by its own panel", () => {
    const own = box({ top: 40, height: 8, finalHeight: 180 });

    expect(project({ top: 0, height: 48 }, own, [own])).toMatchObject({
      top: 0,
      height: 220,
    });
  });

  it("pulls the item up by a sibling collapsing above it", () => {
    // The single-open case: pressing a fold shuts the open one above it, so the
    // fold you pressed rises by that panel's height over the same 200ms.
    const closing = box({ top: 20, height: 180, finalHeight: 0 });
    const own = box({ top: 240, height: 8, finalHeight: 100 });

    expect(project({ top: 200, height: 48 }, own, [closing, own])).toMatchObject(
      { top: 20, height: 140 },
    );
  });

  it("ignores a panel below the item", () => {
    const below = box({ top: 300, height: 8, finalHeight: 180 });
    const own = box({ top: 40, height: 8, finalHeight: 100 });

    expect(project({ top: 0, height: 48 }, own, [own, below]).top).toBe(0);
  });

  it("counts every animating panel in the content delta, above or below", () => {
    const closing = box({ top: 20, height: 180, finalHeight: 0 });
    const own = box({ top: 240, height: 8, finalHeight: 100 });

    expect(
      project({ top: 200, height: 48 }, own, [closing, own]).contentDelta,
    ).toBe(-88);
  });
});

describe("nearestDelta", () => {
  const view = { top: 100, height: 200 };

  it("leaves a fold already fully visible exactly where it is", () => {
    expect(nearestDelta({ top: 120, height: 60 }, view)).toBe(0);
  });

  it("brings up a fold hanging off the bottom, and no further", () => {
    // Bottom lands at 340, twenty past the view's 300.
    expect(nearestDelta({ top: 220, height: 120 }, view)).toBe(40);
  });

  it("aligns the top of a fold that starts above the view", () => {
    expect(nearestDelta({ top: 60, height: 80 }, view)).toBe(-40);
  });

  it("shows the top of a fold taller than the scroller, not its bottom", () => {
    expect(nearestDelta({ top: 160, height: 400 }, view)).toBe(60);
  });
});

describe("scrollAt", () => {
  it("tracks the panel's height between the two ends", () => {
    expect(scrollAt(0, 100, 8, 8, 208)).toBe(0);
    expect(scrollAt(0, 100, 108, 8, 208)).toBe(50);
    expect(scrollAt(0, 100, 208, 8, 208)).toBe(100);
  });

  it("lands on the target at once when there is nothing to animate", () => {
    // `prefers-reduced-motion` kills the transition, so the panel is already at
    // its final height by the time the effect looks at it.
    expect(scrollAt(0, 100, 180, 180, 180)).toBe(100);
  });

  it("clamps a height read outside the two ends", () => {
    expect(scrollAt(0, 100, 4, 8, 208)).toBe(0);
    expect(scrollAt(0, 100, 300, 8, 208)).toBe(100);
  });

  it("tracks a collapse as readily as a growth", () => {
    expect(scrollAt(100, 0, 90, 180, 0)).toBe(50);
  });
});

describe("pickBestDelta", () => {
  it("prefers the fold that is growing over the one closing under it", () => {
    // The single-open switch: press a fold and another collapses in the same
    // commit. The one you pressed is the answer, however much bigger the other is.
    expect(pickBestDelta([-480, 0, 120])).toBe(2);
  });

  it("takes the shrinker when nothing is growing", () => {
    // A plain close, which is the collapse that used to jump 289px at the end.
    expect(pickBestDelta([0, -300, 0])).toBe(1);
  });

  it("takes the biggest of several growing", () => {
    expect(pickBestDelta([40, 300, 90])).toBe(1);
  });

  it("is null when nothing is moving", () => {
    // Reduced motion lands here, which is why `pickFold` has a second answer.
    expect(pickBestDelta([0, 0, 0])).toBeNull();
    expect(pickBestDelta([])).toBeNull();
  });
});
