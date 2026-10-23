import { describe, expect, it } from "vitest";

import { landDots } from "../world-dots";

import { equirect } from "./projection";

describe("equirect", () => {
  it("maps the corners of the rectangle to 0 and 1", () => {
    const bounds = { west: -10, east: 30, north: 60, south: 40 };
    expect(equirect({ lng: -10, lat: 60 }, bounds)).toEqual({ x: 0, y: 0 });
    expect(equirect({ lng: 30, lat: 40 }, bounds)).toEqual({ x: 1, y: 1 });
  });
});

describe("landDots", () => {
  it("has land where Europe is and none out at sea", () => {
    const dots = landDots("europe");
    const near = (lng: number, lat: number) =>
      dots.some((d) => Math.abs(d.lng - lng) <= 0.5 && Math.abs(d.lat - lat) <= 0.5);

    expect(near(2.35, 48.86)).toBe(true); // Paris
    expect(near(13.4, 52.52)).toBe(true); // Berlin
    expect(near(-11, 45)).toBe(false); // the Atlantic, off the Bay of Biscay
    expect(near(3, 56)).toBe(false); // the North Sea
  });
});
