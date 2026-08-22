import { describe, expect, it } from "vitest";

import { distanceKm, formatDistance, formatDistanceM, pathLengthM } from "./geo";

/**
 * Real coordinates with a distance anyone can check, because that is the point:
 * a length function that is self-consistently wrong passes every test written
 * against its own output.
 */
const OSLO = { lat: 59.9139, lng: 10.7522 };
const BERGEN = { lat: 60.3913, lng: 5.3221 };
const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };

describe("distanceKm", () => {
  it("measures a known city pair", () => {
    // Great-circle Oslo→Bergen is about 305km. Overland driving is far longer,
    // which is exactly the difference a routed path would have shown.
    expect(distanceKm(OSLO, BERGEN)).toBeCloseTo(305, 0);
  });

  it("is symmetric", () => {
    expect(distanceKm(OSLO, BERGEN)).toBeCloseTo(distanceKm(BERGEN, OSLO), 9);
  });

  it("is zero for a point against itself", () => {
    expect(distanceKm(OSLO, OSLO)).toBe(0);
  });

  it("handles a pair either side of the equator", () => {
    expect(distanceKm({ lat: -1, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(222.4, 0);
  });
});

describe("pathLengthM", () => {
  it("is zero for a path that cannot have a length", () => {
    expect(pathLengthM([])).toBe(0);
    expect(pathLengthM([[10, 59]])).toBe(0);
  });

  it("matches the two-point distance for a two-point line", () => {
    const metres = pathLengthM([
      [OSLO.lng, OSLO.lat],
      [BERGEN.lng, BERGEN.lat],
    ]);

    expect(metres).toBeCloseTo(distanceKm(OSLO, BERGEN) * 1000, 6);
  });

  it("follows every bend rather than cutting the corner", () => {
    const viaBergen = pathLengthM([
      [OSLO.lng, OSLO.lat],
      [BERGEN.lng, BERGEN.lat],
      [STOCKHOLM.lng, STOCKHOLM.lat],
    ]);

    const direct = pathLengthM([
      [OSLO.lng, OSLO.lat],
      [STOCKHOLM.lng, STOCKHOLM.lat],
    ]);

    // The whole reason this sums segments: a line clicked around a coastline is
    // not as long as the crow flies, and reporting the shortcut would report a
    // distance nobody drew.
    expect(viaBergen).toBeGreaterThan(direct);
    expect(viaBergen).toBeCloseTo(
      pathLengthM([
        [OSLO.lng, OSLO.lat],
        [BERGEN.lng, BERGEN.lat],
      ]) +
        pathLengthM([
          [BERGEN.lng, BERGEN.lat],
          [STOCKHOLM.lng, STOCKHOLM.lat],
        ]),
      6,
    );
  });

  it("counts a doubled-back path at its full travelled length", () => {
    const there = pathLengthM([
      [OSLO.lng, OSLO.lat],
      [BERGEN.lng, BERGEN.lat],
    ]);

    const andBack = pathLengthM([
      [OSLO.lng, OSLO.lat],
      [BERGEN.lng, BERGEN.lat],
      [OSLO.lng, OSLO.lat],
    ]);

    expect(andBack).toBeCloseTo(there * 2, 6);
  });
});

describe("formatDistance", () => {
  it("says metres below a kilometre", () => {
    expect(formatDistance(0.42)).toBe("420 m");
  });

  it("keeps one decimal in the single digits", () => {
    expect(formatDistance(2.437)).toBe("2.4 km");
  });

  it("drops the decimal once it stops meaning anything", () => {
    expect(formatDistance(463.218)).toBe("463 km");
  });

  it("reads metres straight off a stored length", () => {
    // Everything upstream stores metres, so this is the form the shape card and
    // the embed popup actually call.
    expect(formatDistanceM(463_218)).toBe("463 km");
    expect(formatDistanceM(420)).toBe("420 m");
  });
});
