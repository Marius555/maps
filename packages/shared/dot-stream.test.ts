import { describe, expect, it } from "vitest";

import { dotSpacingFor } from "./dot-line";
import { dotStream, dotView, dotViewHolds, type DotBounds } from "./dot-stream";

/** ~700m of one street, east-west, with a bend in it. */
const street: [number, number][] = [
  [25.27, 54.687],
  [25.275, 54.687],
  [25.279, 54.6885],
  [25.28, 54.6885],
];

const ZOOM = 16.4;
const WIDTH = 4;

/** Distance between two dots in Web Mercator pixels at `level`. */
function pixelsApart(a: [number, number], b: [number, number], level: number) {
  const world = 512 * 2 ** level;
  const project = ([lng, lat]: [number, number]) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    return [
      ((lng + 180) / 360) * world,
      (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world,
    ];
  };
  const [ax, ay] = project(a);
  const [bx, by] = project(b);
  return Math.hypot(bx - ax, by - ay);
}

const key = ([lng, lat]: [number, number]) => `${lng.toFixed(9)},${lat.toFixed(9)}`;

describe("dotStream", () => {
  it("spaces one lane's dots at the dotted layer's pitch, at the whole zoom", () => {
    const dots = dotStream(street, WIDTH, 0, 1, ZOOM);

    expect(dots.length).toBeGreaterThan(50);
    // Along the first, straight leg: exactly one pitch apart.
    expect(pixelsApart(dots[0], dots[1], 16)).toBeCloseTo(dotSpacingFor(WIDTH), 6);
  });

  it("splits the stream between lanes with nothing left over and nothing twice", () => {
    const all = dotStream(street, WIDTH, 0, 1, ZOOM).map(key);
    const lanes = [0, 1, 2].map((lane) =>
      dotStream(street, WIDTH, lane, 3, ZOOM).map(key),
    );

    expect(lanes.flat().sort()).toEqual([...all].sort());
    expect(new Set(lanes.flat()).size).toBe(all.length);
  });

  it("takes turns: lane k of two holds every other dot, from the k-th", () => {
    const all = dotStream(street, WIDTH, 0, 1, ZOOM).map(key);

    expect(dotStream(street, WIDTH, 0, 2, ZOOM).map(key)).toEqual(
      all.filter((_, index) => index % 2 === 0),
    );
    expect(dotStream(street, WIDTH, 1, 2, ZOOM).map(key)).toEqual(
      all.filter((_, index) => index % 2 === 1),
    );
  });

  it("keeps at least half a pitch clear of both ends", () => {
    const dots = dotStream(street, WIDTH, 0, 1, ZOOM);
    const half = dotSpacingFor(WIDTH) / 2;

    expect(pixelsApart(street[0], dots[0], 16)).toBeGreaterThanOrEqual(half - 1e-6);
    expect(pixelsApart(dots.at(-1)!, street.at(-1)!, 16)).toBeGreaterThanOrEqual(
      half - 1e-6,
    );
  });

  it("draws nothing on a stretch shorter than one pitch", () => {
    expect(dotStream([street[0], [25.2700001, 54.687]], WIDTH, 0, 1, ZOOM)).toEqual([]);
  });

  it("gives a dot the same lane whatever area it was worked out for", () => {
    const bounds: DotBounds = [25.274, 54.686, 25.276, 54.688];
    const view = dotView(bounds, ZOOM);
    const whole = dotStream(street, WIDTH, 1, 2, ZOOM).map(key);
    const clipped = dotStream(street, WIDTH, 1, 2, ZOOM, view.box).map(key);

    expect(clipped.length).toBeGreaterThan(0);
    expect(clipped.length).toBeLessThan(whole.length);
    expect(clipped.every((dot) => whole.includes(dot))).toBe(true);
  });
});

describe("dotViewHolds", () => {
  const bounds: DotBounds = [25.27, 54.68, 25.28, 54.69];

  it("holds for a small pan within the same whole zoom level", () => {
    const view = dotView(bounds, 15.2);

    expect(dotViewHolds(view, bounds, 15.9)).toBe(true);
    expect(dotViewHolds(view, [25.275, 54.68, 25.285, 54.69], 15.2)).toBe(true);
  });

  it("gives way at the next level, off the area, and with nothing drawn yet", () => {
    const view = dotView(bounds, 15.2);

    expect(dotViewHolds(view, bounds, 16)).toBe(false);
    expect(dotViewHolds(view, [25.3, 54.68, 25.31, 54.69], 15.2)).toBe(false);
    expect(dotViewHolds(null, bounds, 15.2)).toBe(false);
  });
});
