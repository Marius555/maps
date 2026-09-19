// @vitest-environment jsdom

/**
 * The card's placement geometry.
 *
 * Untested until a card started opening underneath the floating results panel,
 * which is the kind of bug that only ever shows on a screen: the geometry was
 * handed the whole map frame, the panel is an overlay *inside* that frame, and
 * every answer was correct arithmetic over the wrong rectangle. The phone
 * repeated it with the bottom sheet's peek strip. So the rectangle is what these
 * hold — that a placement keeps the whole card inside the room it was told
 * about, on every layout the embed has, and on the side the owner expects.
 *
 * jsdom for `usableFrame` alone, which reads `getBoundingClientRect`s. It
 * measures rather than reading `data-lm-side`, so the fixtures below build the
 * layouts as rectangles and never as settings.
 */

import { describe, expect, it, vi } from "vitest";

import {
  CARD_MARGIN,
  cardPlacement,
  cardSide,
  usableFrame,
  type CardSide,
  type UsableFrame,
} from "./card-place";

const FRAME: UsableFrame = { left: 0, top: 0, right: 1120, bottom: 730 };

/** The publish preview, measured: a 381px panel floating against the right edge. */
const PANEL_RIGHT: UsableFrame = { left: 0, top: 0, right: 730, bottom: 730 };

/**
 * The publish preview's phone, measured at 390px: the search bar floating over
 * the top to y47, the sheet's peek strip from y687.
 */
const PHONE: UsableFrame = { left: 0, top: 47, right: 389, bottom: 686 };

const CARD = { width: 320, height: 440 };
const GAP = 24;

/**
 * Where the card actually lands, given the side and the pin.
 *
 * `left` names the edge of the *card* that is pinned — MapLibre's convention,
 * which reads backwards — so this is also the one place the tests spell that
 * out rather than trusting it.
 */
function cardRect(
  side: CardSide,
  x: number,
  y: number,
  card = CARD,
): { left: number; top: number; right: number; bottom: number } {
  if (side === "top") {
    return {
      left: x - card.width / 2,
      top: y + GAP,
      right: x + card.width / 2,
      bottom: y + GAP + card.height,
    };
  }

  return {
    left: x + GAP,
    top: y - card.height / 2,
    right: x + GAP + card.width,
    bottom: y + card.height / 2,
  };
}

function expectInside(
  side: CardSide,
  placed: { x: number; y: number },
  usable: UsableFrame,
  card = CARD,
): void {
  const box = cardRect(side, placed.x, placed.y, card);

  expect(box.left).toBeGreaterThanOrEqual(usable.left + CARD_MARGIN - 0.001);
  expect(box.top).toBeGreaterThanOrEqual(usable.top + CARD_MARGIN - 0.001);
  expect(box.right).toBeLessThanOrEqual(usable.right - CARD_MARGIN + 0.001);
  expect(box.bottom).toBeLessThanOrEqual(usable.bottom - CARD_MARGIN + 0.001);
  // And the pin itself is on the map, not under whatever was cut away.
  expect(placed.x).toBeGreaterThanOrEqual(usable.left);
  expect(placed.x).toBeLessThanOrEqual(usable.right);
  expect(placed.y).toBeGreaterThanOrEqual(usable.top);
  expect(placed.y).toBeLessThanOrEqual(usable.bottom);
}

function place(
  usable: UsableFrame,
  x: number,
  y: number,
  card = CARD,
  pair?: boolean,
) {
  const side = cardSide(card.width, usable);

  return {
    side,
    ...cardPlacement(side, card.width, card.height, usable, GAP, x, y, pair),
  };
}

describe("cardSide", () => {
  it("opens beside the pin on a map at least twice the card's width", () => {
    expect(cardSide(320, FRAME)).toBe("left");
    expect(cardSide(320, PANEL_RIGHT)).toBe("left");
  });

  it("opens below the pin on a phone, even for the narrowest card", () => {
    expect(cardSide(220, PHONE)).toBe("top");
  });

  it("opens below the pin where the card would take most of the width", () => {
    expect(cardSide(400, PANEL_RIGHT)).toBe("top");
  });
});

describe("cardPlacement", () => {
  it("costs nothing where the card already fits to the right", () => {
    const best = place(FRAME, 560, 365);

    expect(best.side).toBe("left");
    expect([best.x, best.y]).toEqual([560, 365]);
    expectInside(best.side, best, FRAME);
  });

  it("moves a pin near the right edge only as far as the card needs", () => {
    const best = place(FRAME, 1000, 365);

    expect(best.side).toBe("left");
    // The card's right edge lands on the margin, not a pixel further.
    expect(best.x).toBe(FRAME.right - CARD.width - GAP - CARD_MARGIN);
    expect(best.y).toBe(365);
    expectInside(best.side, best, FRAME);
  });

  it("never places the card over a floating results panel", () => {
    /*
     * The reported bug, as a number. This pin is 585px across a 1120px frame;
     * the card to its right would put 175px of it under a panel starting at 730.
     */
    const best = place(PANEL_RIGHT, 585, 365);

    expect(best.cap).toBeUndefined();
    expectInside(best.side, best, PANEL_RIGHT);
  });

  it("keeps the card clear of a panel on the left too", () => {
    const panelLeft: UsableFrame = { left: 390, top: 0, right: 1120, bottom: 730 };
    const best = place(panelLeft, 400, 365);

    expectInside(best.side, best, panelLeft);
  });

  it("puts the pin above its card on a phone and lifts it just enough", () => {
    const card = { width: 220, height: 300 };
    const best = place(PHONE, 195, 600, card);

    expect(best.side).toBe("top");
    expect(best.cap).toBeUndefined();
    expect(best.y).toBe(PHONE.bottom - card.height - GAP - CARD_MARGIN);
    expectInside(best.side, best, PHONE, card);
  });

  it("cuts a card taller than the phone below a pin at the top", () => {
    // 640px of map between the search bar and the strip; a 720px card.
    const card = { width: 360, height: 720 };
    const best = place(PHONE, 100, 400, card);

    expect(best.side).toBe("top");
    expect(best.y).toBe(PHONE.top + GAP);
    expect(best.cap).toBe(PHONE.bottom - best.y - GAP - CARD_MARGIN);
    // Across, the whole card is still on the phone: 360px has 9px of play.
    const box = cardRect(best.side, best.x, best.y, card);
    expect(box.left).toBeGreaterThanOrEqual(PHONE.left + CARD_MARGIN);
    expect(box.right).toBeLessThanOrEqual(PHONE.right - CARD_MARGIN);
  });

  it("cuts a card taller than a wide frame beside a pin in the middle", () => {
    const short: UsableFrame = { left: 0, top: 0, right: 1120, bottom: 257 };
    const best = place(short, 560, 30);

    expect(best.side).toBe("left");
    expect(best.y).toBe(257 / 2);
    expect(best.cap).toBe(257 - 2 * CARD_MARGIN);
  });

  it("lands a flight with the pin and its card centred together", () => {
    const best = place(FRAME, 560, 365, CARD, true);

    const box = cardRect(best.side, best.x, best.y);
    // The pair spans from the pin to the card's far edge.
    const middle = (best.x + box.right) / 2;

    expect(Math.abs(middle - 560)).toBeLessThan(GAP);
    expect(best.y).toBe(365);
    expectInside(best.side, best, FRAME);
  });

  it("lands a phone flight with the pin above its card, both centred", () => {
    const card = { width: 220, height: 300 };
    const midY = (PHONE.top + PHONE.bottom) / 2;
    const best = place(PHONE, 195, midY, card, true);

    const box = cardRect(best.side, best.x, best.y, card);

    expect(best.side).toBe("top");
    expect(Math.abs((best.y + box.bottom) / 2 - midY)).toBeLessThan(GAP);
    expectInside(best.side, best, PHONE, card);
  });
});

describe("usableFrame", () => {
  type Box = { left: number; right: number; top?: number; bottom?: number };

  /**
   * jsdom has no Web Animations, so a stand-in with the three members
   * `usableFrame` touches: the class it filters on, a current time it moves and
   * puts back, and the end time it moves it to.
   */
  class FakeTransition {
    currentTime: number | null;
    readonly effect: { getComputedTiming: () => { endTime: number } };

    constructor(at: number, end: number) {
      this.currentTime = at;
      this.effect = { getComputedTiming: () => ({ endTime: end }) };
    }
  }

  vi.stubGlobal("CSSTransition", FakeTransition);

  /**
   * A 1120x730 frame at (100, 50) on the page, with overlays given in the
   * frame's own pixels. An overlay with no `top`/`bottom` stands the frame's
   * full height, which is what a floating results panel does.
   */
  function layout(
    overlays: (Box & { className?: string })[] = [],
    running: FakeTransition[] = [],
  ): { frame: HTMLElement } {
    const root = document.createElement("div");
    root.className = "lm-root";
    root.getAnimations = () => running as unknown as Animation[];

    const frame = document.createElement("div");
    frame.className = "lm-canvas";
    Object.defineProperty(frame, "clientWidth", { value: 1120 });
    Object.defineProperty(frame, "clientHeight", { value: 730 });
    frame.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 1220, bottom: 780 }) as DOMRect;

    root.append(frame);

    for (const box of overlays) {
      const el = document.createElement("div");
      el.className = box.className ?? "lm-panel";
      el.getBoundingClientRect = () =>
        ({
          left: 100 + box.left,
          top: 50 + (box.top ?? 0),
          right: 100 + box.right,
          bottom: 50 + (box.bottom ?? 730),
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
    expect(usableFrame(layout([{ left: 730, right: 1111 }]).frame).right).toBe(730);
  });

  it("cuts the left edge back for a panel floating there", () => {
    expect(usableFrame(layout([{ left: 9, right: 390 }]).frame).left).toBe(390);
  });

  it("leaves the frame alone for a docked panel beside it", () => {
    // Docked, the panel is a flex *sibling* of the canvas, so it starts where
    // the frame ends and never intersects it.
    expect(usableFrame(layout([{ left: 1120, right: 1501 }]).frame)).toEqual({
      left: 0,
      top: 0,
      right: 1120,
      bottom: 730,
    });
  });

  it("cuts the bottom back for the sheet's peek strip, not a side", () => {
    /*
     * The phone bug. The strip spans the map's width and rises 44px into it;
     * a horizontal-only test cut the frame to the 10px beside the strip and
     * left no side any card fitted on.
     */
    const usable = usableFrame(
      layout([{ left: 10, right: 1110, top: 686, bottom: 1161 }]).frame,
    );

    expect(usable).toEqual({ left: 0, top: 0, right: 1120, bottom: 686 });
  });

  it("cuts the top back for a floating search bar", () => {
    const usable = usableFrame(
      layout([{ className: "lm-toolbar", left: 10, right: 380, top: 10, bottom: 46 }])
        .frame,
    );

    expect(usable).toEqual({ left: 0, top: 46, right: 1120, bottom: 730 });
  });

  it("ignores a search bar inside a panel that is already cut away", () => {
    const usable = usableFrame(
      layout([
        { left: 730, right: 1111 },
        { className: "lm-toolbar", left: 740, right: 1100, top: 10, bottom: 46 },
      ]).frame,
    );

    expect(usable).toEqual({ left: 0, top: 0, right: 730, bottom: 730 });
  });

  it("reads a closing sheet where it will be, and leaves the slide alone", () => {
    /*
     * The flight's bug. A row tapped in the open sheet closes it and starts the
     * flight in one task; read mid-slide, the sheet still covered the map from
     * y256 and the card was planned — and cut — against the strip above it.
     */
    const slide = new FakeTransition(0, 180);
    const sheet: Box = {
      left: 10,
      right: 1110,
      bottom: 1161,
      get top() {
        return slide.currentTime === 180 ? 686 : 256;
      },
    };

    const usable = usableFrame(layout([sheet], [slide]).frame);

    expect(usable.bottom).toBe(686);
    // Put back exactly where it was, so the sheet goes on sliding from there.
    expect(slide.currentTime).toBe(0);
  });

  it("ignores an overlay that covers the whole map", () => {
    // An open sheet: there is no better room for the card than the frame.
    expect(
      usableFrame(layout([{ left: 0, right: 1120, top: -10, bottom: 740 }]).frame),
    ).toEqual({ left: 0, top: 0, right: 1120, bottom: 730 });
  });
});
