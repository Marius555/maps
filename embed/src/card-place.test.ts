// @vitest-environment jsdom

/**
 * The card's placement geometry.
 *
 * Untested until a card started opening underneath the floating results panel,
 * which is the kind of bug that only ever shows on a screen: `cardBands` was
 * handed the whole map frame, the panel is an overlay *inside* that frame, and
 * every answer was correct arithmetic over the wrong rectangle. So the rectangle
 * is what these hold — that a placement keeps the whole card inside the room it
 * was told about, on every layout the panel has.
 *
 * jsdom for `usableFrame` alone, which reads two `getBoundingClientRect`s. It
 * measures rather than reading `data-lm-side`, so the fixtures below build the
 * three layouts as rectangles and never as settings.
 */

import { describe, expect, it } from "vitest";

import {
  CARD_MARGIN,
  cardBands,
  chooseBand,
  usableFrame,
  type UsableFrame,
} from "./card-place";

const FRAME: UsableFrame = { left: 0, top: 0, right: 1120, bottom: 730 };

/** The publish preview, measured: a 381px panel floating against the right edge. */
const PANEL_RIGHT: UsableFrame = { left: 0, top: 0, right: 730, bottom: 730 };

const CARD = { width: 320, height: 440 };
const GAP = 14;

/**
 * Where the card actually lands, given the side and the pin.
 *
 * `left` and `right` name the edge of the *card* that is pinned — MapLibre's
 * convention, which reads backwards — so this is also the one place the tests
 * spell that out rather than trusting it.
 */
function cardRect(
  anchor: string,
  x: number,
  y: number,
): { left: number; top: number; right: number; bottom: number } {
  const halfW = CARD.width / 2;
  const halfH = CARD.height / 2;

  if (anchor === "bottom") {
    return {
      left: x - halfW,
      top: y - GAP - CARD.height,
      right: x + halfW,
      bottom: y - GAP,
    };
  }

  if (anchor === "top") {
    return {
      left: x - halfW,
      top: y + GAP,
      right: x + halfW,
      bottom: y + GAP + CARD.height,
    };
  }

  if (anchor === "left") {
    return {
      left: x + GAP,
      top: y - halfH,
      right: x + GAP + CARD.width,
      bottom: y + halfH,
    };
  }

  return {
    left: x - GAP - CARD.width,
    top: y - halfH,
    right: x - GAP,
    bottom: y + halfH,
  };
}

function expectInside(
  placement: { anchor: string; x: number; y: number },
  usable: UsableFrame,
): void {
  const card = cardRect(placement.anchor, placement.x, placement.y);

  expect(card.left).toBeGreaterThanOrEqual(usable.left + CARD_MARGIN - 0.001);
  expect(card.top).toBeGreaterThanOrEqual(usable.top + CARD_MARGIN - 0.001);
  expect(card.right).toBeLessThanOrEqual(usable.right - CARD_MARGIN + 0.001);
  expect(card.bottom).toBeLessThanOrEqual(usable.bottom - CARD_MARGIN + 0.001);
}

function place(usable: UsableFrame, x: number, y: number) {
  return chooseBand(cardBands(CARD.width, CARD.height, usable, GAP), x, y);
}

describe("cardBands", () => {
  it("costs nothing where the card already fits", () => {
    // Low in a roomy frame: there is room above the pin, which is the side
    // MapLibre and everyone else expects a popup to take.
    const best = place(FRAME, 560, 600);

    expect(best?.anchor).toBe("bottom");
    expect(best?.move).toBe(0);
    expectInside(best!, FRAME);
  });

  it("keeps the whole card inside the frame from a pin in the middle", () => {
    const best = place(FRAME, 560, 365);

    expect(best).not.toBeNull();
    expectInside(best!, FRAME);
  });

  it("never places the card over a floating results panel", () => {
    /*
     * The reported bug, as a number. This pin is 585px across a 1120px frame;
     * against the whole frame the cheapest answer was `left` — the card to the
     * *right* of the pin — which put 175px of it under a panel starting at 730.
     */
    const wrong = place(FRAME, 585, 365);
    expect(wrong?.anchor).toBe("left");

    const best = place(PANEL_RIGHT, 585, 365);
    expect(best).not.toBeNull();
    expectInside(best!, PANEL_RIGHT);
  });

  it("keeps the card clear of a panel on the left too", () => {
    const panelLeft: UsableFrame = { left: 390, top: 0, right: 1120, bottom: 730 };
    const best = place(panelLeft, 500, 365);

    expect(best).not.toBeNull();
    expectInside(best!, panelLeft);
  });

  it("has no answer for a frame smaller than the card on every side", () => {
    // The phone case: 558x257 with a 440px card. Nothing the camera can do
    // fits it, which is what sends `flyToCard` to the cap instead.
    expect(place({ left: 0, top: 0, right: 558, bottom: 257 }, 279, 128)).toBeNull();
  });

  it("prefers the side that costs least, not the first that fits", () => {
    // Hard against the top edge, so `bottom` (the card above the pin) is out and
    // `top` costs nothing.
    const best = place(FRAME, 560, 30);

    expect(best?.anchor).toBe("top");
    expect(best?.move).toBe(0);
  });
});

describe("usableFrame", () => {
  function layout(panel?: {
    left: number;
    right: number;
  }): { frame: HTMLElement } {
    const root = document.createElement("div");
    root.className = "lm-root";

    const frame = document.createElement("div");
    frame.className = "lm-canvas";
    Object.defineProperty(frame, "clientWidth", { value: 1120 });
    Object.defineProperty(frame, "clientHeight", { value: 730 });
    frame.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 1220, bottom: 780 }) as DOMRect;

    root.append(frame);

    if (panel) {
      const el = document.createElement("div");
      el.className = "lm-panel";
      el.getBoundingClientRect = () =>
        ({
          left: 100 + panel.left,
          top: 50,
          right: 100 + panel.right,
          bottom: 780,
        }) as DOMRect;
      root.append(el);
    }

    document.body.append(root);

    return { frame };
  }

  it("is the whole frame when there is no panel", () => {
    expect(usableFrame(layout().frame)).toEqual({
      left: 0,
      top: 0,
      right: 1120,
      bottom: 730,
    });
  });

  it("cuts the right edge back for a panel floating there", () => {
    // The publish preview's own numbers: a 381px panel from x730.
    expect(usableFrame(layout({ left: 730, right: 1111 }).frame).right).toBe(730);
  });

  it("cuts the left edge back for a panel floating there", () => {
    expect(usableFrame(layout({ left: 9, right: 390 }).frame).left).toBe(390);
  });

  it("leaves the frame alone for a docked panel beside it", () => {
    // Docked, the panel is a flex *sibling* of the canvas, so it starts where
    // the frame ends and never intersects it.
    expect(usableFrame(layout({ left: 1120, right: 1501 }).frame)).toEqual({
      left: 0,
      top: 0,
      right: 1120,
      bottom: 730,
    });
  });
});
