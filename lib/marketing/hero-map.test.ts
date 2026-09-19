import { describe, expect, it } from "vitest";

import { resolvePin } from "@/packages/shared/pin-icons";

import {
  CARD_GAP,
  HERO_CAMERA,
  HERO_PIN_ICONS,
  HERO_PINS,
  HERO_TOUR,
  HERO_YOU_ARE_HERE,
  dropRanks,
  nearestPin,
  pinInFrame,
  placeCard,
  projectPin,
  stageBox,
} from "./hero-map";

describe("projectPin", () => {
  it("puts the camera's own centre in the middle of the picture", () => {
    const { x, y } = projectPin(HERO_CAMERA.center);

    expect(x).toBeCloseTo(50, 6);
    expect(y).toBeCloseTo(50, 6);
  });

  it("puts east to the right and north towards the top", () => {
    const { lng, lat } = HERO_CAMERA.center;
    const east = projectPin({ lng: lng + 0.01, lat });
    const north = projectPin({ lng, lat: lat + 0.01 });

    expect(east.x).toBeGreaterThan(50);
    expect(east.y).toBeCloseTo(50, 6);
    expect(north.y).toBeLessThan(50);
    expect(north.x).toBeCloseTo(50, 6);
  });

  /*
   * One zoom level is twice the pixels. A projection that got the tile size
   * wrong (256 against MapLibre's 512) would put every pin twice as far from
   * the centre as the street it belongs on, and this is the cheapest check of
   * the scale itself rather than of the direction.
   */
  it("doubles the distance from the centre with each zoom level", () => {
    const point = { lng: HERO_CAMERA.center.lng + 0.05, lat: HERO_CAMERA.center.lat };
    const near = projectPin(point, { ...HERO_CAMERA, zoom: 10 });
    const far = projectPin(point, { ...HERO_CAMERA, zoom: 11 });

    expect(far.x - 50).toBeCloseTo((near.x - 50) * 2, 6);
  });
});

describe("HERO_PINS", () => {
  it("all land on the picture, clear of its edges", () => {
    for (const pin of HERO_PINS) {
      const { x, y } = projectPin(pin);

      expect(x, pin.name).toBeGreaterThan(5);
      expect(x, pin.name).toBeLessThan(95);
      expect(y, pin.name).toBeGreaterThan(5);
      expect(y, pin.name).toBeLessThan(95);
    }
  });

  // A custom pin naming a glyph that is not in the registry resolves to null
  // and would be drawn as a plain ball, silently losing the icon.
  it("resolves every custom pin to a drawing", () => {
    for (const icon of HERO_PIN_ICONS) {
      expect(resolvePin(`custom:${icon.id}`, HERO_PIN_ICONS), icon.id).not.toBeNull();
    }
  });
});

describe("HERO_TOUR", () => {
  /*
   * A phone crops the picture to its middle half, so a stop outside that band
   * opens a card on a pin nobody can see.
   */
  it("stops only at pins a phone's crop still shows", () => {
    for (const name of HERO_TOUR) {
      const pin = HERO_PINS.find((candidate) => candidate.name === name);

      expect(pin, name).toBeDefined();
      expect(projectPin(pin!).x, name).toBeGreaterThan(32);
      expect(projectPin(pin!).x, name).toBeLessThan(68);
    }
  });
});

describe("stageBox", () => {
  it("fills a frame of the picture's own shape exactly", () => {
    expect(stageBox({ width: 1200, height: 600 })).toEqual({
      left: 0,
      top: 0,
      width: 1200,
      height: 600,
    });
  });

  it("covers a square frame by cropping the sides, centred", () => {
    const box = stageBox({ width: 400, height: 400 });

    expect(box.width).toBe(800);
    expect(box.height).toBe(400);
    expect(box.left).toBe(-200);
    expect(box.top).toBe(0);
  });

  it("covers a very wide frame by cropping top and bottom", () => {
    const box = stageBox({ width: 1600, height: 400 });

    expect(box.width).toBe(1600);
    expect(box.height).toBe(800);
    expect(box.top).toBe(-200);
  });
});

describe("pinInFrame", () => {
  it("puts the picture's centre in the frame's centre at any shape", () => {
    for (const frame of [
      { width: 1200, height: 600 },
      { width: 360, height: 352 },
      { width: 1600, height: 400 },
    ]) {
      expect(pinInFrame({ x: 50, y: 50 }, frame)).toEqual({
        x: frame.width / 2,
        y: frame.height / 2,
      });
    }
  });

  it("follows the crop: a quarter of the way across a square frame's picture is its left edge", () => {
    expect(pinInFrame({ x: 25, y: 0 }, { width: 400, height: 400 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("placeCard", () => {
  const frame = { width: 1000, height: 500 };
  const card = { width: 220, height: 140 };
  const insets = { top: 60, right: 12, bottom: 12, left: 12 };

  it("opens right of the pin, centred on it, where there is room", () => {
    const placed = placeCard({ x: 300, y: 250 }, card, frame, insets);

    expect(placed).toEqual({ x: 300 + CARD_GAP, y: 250 - 70, side: "right" });
  });

  it("flips left when the right would run off the frame", () => {
    const placed = placeCard({ x: 900, y: 250 }, card, frame, insets);

    expect(placed.side).toBe("left");
    expect(placed.x + card.width).toBe(900 - CARD_GAP);
  });

  it("opens left first when asked, and still falls back to the right", () => {
    expect(placeCard({ x: 300, y: 250 }, card, frame, insets, "left").side).toBe("left");
    expect(placeCard({ x: 100, y: 250 }, card, frame, insets, "left").side).toBe("right");
  });

  it("stays below the top inset when the pin is near the top", () => {
    const placed = placeCard({ x: 300, y: 40 }, card, frame, insets);

    expect(placed.y).toBe(insets.top);
  });

  it("drops below the pin on a frame too narrow for either side", () => {
    const narrow = { width: 360, height: 352 };
    const placed = placeCard({ x: 180, y: 120 }, card, narrow, insets);

    expect(placed.side).toBe("below");
    expect(placed.y).toBe(120 + CARD_GAP);
    expect(placed.x).toBeGreaterThanOrEqual(insets.left);
    expect(placed.x + card.width).toBeLessThanOrEqual(narrow.width - insets.right);
  });

  it("goes above the pin when below does not fit either", () => {
    const narrow = { width: 360, height: 352 };
    const placed = placeCard({ x: 180, y: 300 }, card, narrow, insets);

    expect(placed.side).toBe("above");
    expect(placed.y + card.height).toBeLessThanOrEqual(300 - CARD_GAP);
  });
});

describe("nearestPin", () => {
  it("finds the closest pin and its great-circle distance", () => {
    const found = nearestPin(HERO_YOU_ARE_HERE, HERO_PINS);

    expect(found?.pin.name).toBe("Southbank");
    expect(found?.km).toBeGreaterThan(1.5);
    expect(found?.km).toBeLessThan(2.2);
  });

  it("answers nothing for no pins, rather than inventing one", () => {
    expect(nearestPin(HERO_YOU_ARE_HERE, [])).toBeNull();
  });
});

describe("dropRanks", () => {
  it("ranks every pin once, nearest the centre first", () => {
    const ranks = dropRanks(HERO_PINS);

    expect([...ranks].sort((a, b) => a - b)).toEqual(HERO_PINS.map((_, index) => index));

    const first = HERO_PINS[ranks.indexOf(0)];
    const last = HERO_PINS[ranks.indexOf(HERO_PINS.length - 1)];
    const centre = projectPin(HERO_CAMERA.center);
    const spread = (pin: { lng: number; lat: number }) => {
      const { x, y } = projectPin(pin);
      return Math.hypot(x - centre.x, y - centre.y);
    };

    expect(spread(first)).toBeLessThan(spread(last));
  });
});
