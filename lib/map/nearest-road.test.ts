import { describe, expect, it } from "vitest";

import { matchesRoad, nearestRoad } from "./nearest-road";
import type { RoadFeature } from "./nearest-road";

/**
 * Geometry lifted verbatim from the live OpenFreeMap tile 14/9154/5125 — the one
 * the browser already downloads to draw this part of Klaipėda.
 *
 * This is the reported bug in fixture form. The pin sits on Sinagogų g.; the
 * geocoder called it "Galinio Pylimo g. 7" because that building's *bounding box*
 * covers the pavement. Real centrelines put the question beyond argument, and
 * these numbers were checked against Overpass: 1.2m and 51m.
 */

const SINAGOGU: RoadFeature = {
  properties: { name: "Sinagogų g.", "name:en": "Sinagogų g." },
  geometry: {
    type: "LineString",
    coordinates: [
      [21.137009, 55.705414],
      [21.137518, 55.705157],
      [21.137894, 55.705018],
      [21.137985, 55.705],
      [21.139804, 55.70481],
      [21.140426, 55.704752],
    ],
  },
};

const GALINIO_PYLIMO: RoadFeature = {
  properties: { name: "Galinio Pylimo g." },
  geometry: {
    type: "LineString",
    coordinates: [
      [21.137009, 55.702576],
      [21.137143, 55.702706],
      [21.137336, 55.70296],
      [21.137449, 55.70347],
      [21.13762, 55.704042],
      [21.137685, 55.704229],
      [21.137727, 55.704338],
      [21.13798, 55.70477],
      [21.138082, 55.704988],
      [21.138108, 55.705069],
      [21.1382, 55.705571],
      [21.138323, 55.70617],
      [21.138371, 55.706269],
      [21.138446, 55.70636],
      [21.13865, 55.706487],
      [21.138956, 55.706659],
    ],
  },
};

/** The pin from the bug report. */
const PIN = { lat: 55.704897, lng: 21.13888 };

describe("nearestRoad", () => {
  it("finds the street the reported pin is actually standing on", () => {
    const road = nearestRoad([GALINIO_PYLIMO, SINAGOGU], PIN);

    expect(road?.names[0]).toBe("Sinagogų g.");
    // Overpass, at full precision, says 1.2m. Tile geometry is simplified, so
    // allow a couple of metres — the decision it feeds turns on 1m against 51m.
    expect(road?.distanceM).toBeLessThan(3);
  });

  it("puts the street the geocoder chose fifty metres away", () => {
    const road = nearestRoad([GALINIO_PYLIMO], PIN);

    expect(road?.names[0]).toBe("Galinio Pylimo g.");
    expect(road?.distanceM).toBeGreaterThan(45);
    expect(road?.distanceM).toBeLessThan(60);
  });

  it("does not depend on the order features arrive in", () => {
    const forwards = nearestRoad([SINAGOGU, GALINIO_PYLIMO], PIN);
    const backwards = nearestRoad([GALINIO_PYLIMO, SINAGOGU], PIN);

    expect(forwards?.names[0]).toBe(backwards?.names[0]);
    expect(forwards?.distanceM).toBeCloseTo(backwards?.distanceM ?? -1, 6);
  });

  it("prefers the English name, keeping the local one as an alternative", () => {
    // Photon answers with lang=en, so the label reads better in one language —
    // but the local spelling has to stay, or matching would fail against it.
    const road = nearestRoad(
      [
        {
          properties: { name: "Gedimino pr.", "name:en": "Gediminas Avenue" },
          geometry: {
            type: "LineString",
            coordinates: [
              [21.13888, 55.7048],
              [21.13888, 55.705],
            ],
          },
        },
      ],
      PIN,
    );

    expect(road?.names[0]).toBe("Gediminas Avenue");
    expect(road?.names).toContain("Gedimino pr.");
  });

  it("ignores roads with no name — they cannot be an address", () => {
    const unnamed: RoadFeature = {
      properties: { class: "service" },
      geometry: { type: "LineString", coordinates: [[21.13888, 55.7049], [21.1389, 55.70491]] },
    };

    expect(nearestRoad([unnamed], PIN)).toBeNull();
    expect(nearestRoad([unnamed, SINAGOGU], PIN)?.names[0]).toBe("Sinagogų g.");
  });

  it("returns nothing when every road is beyond the search radius", () => {
    const faraway: RoadFeature = {
      properties: { name: "Somewhere Else" },
      geometry: { type: "LineString", coordinates: [[25.28, 54.68], [25.281, 54.681]] },
    };

    expect(nearestRoad([faraway], PIN)).toBeNull();
  });

  it("handles a MultiLineString, and survives unusable geometry", () => {
    const split: RoadFeature = {
      properties: { name: "Split Road" },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [[25.28, 54.68], [25.281, 54.681]],
          [[21.138885, 55.70485], [21.138885, 55.70495]],
        ],
      },
    };

    expect(nearestRoad([split], PIN)?.names[0]).toBe("Split Road");

    const broken: RoadFeature[] = [
      {},
      { properties: { name: "A" }, geometry: null },
      { properties: { name: "B" }, geometry: { type: "LineString", coordinates: "nope" } },
      { properties: { name: "C" }, geometry: { type: "LineString", coordinates: [[Number.NaN, 55.7]] } },
    ];

    expect(nearestRoad(broken, PIN)).toBeNull();
    expect(nearestRoad([...broken, SINAGOGU], PIN)?.names[0]).toBe("Sinagogų g.");
  });

  it("returns nothing for no features at all", () => {
    expect(nearestRoad([], PIN)).toBeNull();
  });
});

describe("matchesRoad", () => {
  const road = { names: ["Gediminas Avenue", "Gedimino pr."] };

  it("matches either language the same street is spelled in", () => {
    expect(matchesRoad("Gediminas Avenue", road)).toBe(true);
    expect(matchesRoad("Gedimino pr.", road)).toBe(true);
  });

  it("ignores case, punctuation and diacritics", () => {
    const lithuanian = { names: ["Sinagogų g."] };

    expect(matchesRoad("sinagogu g", lithuanian)).toBe(true);
    expect(matchesRoad("Sinagogų  G.", lithuanian)).toBe(true);
  });

  it("calls a genuinely different street a disagreement", () => {
    // The whole point: this is what stops "Galinio Pylimo g. 7" being accepted
    // for a pin measured onto Sinagogų g.
    expect(matchesRoad("Galinio Pylimo g.", { names: ["Sinagogų g."] })).toBe(false);
  });

  it("is false when either side is missing", () => {
    expect(matchesRoad(undefined, road)).toBe(false);
    expect(matchesRoad("", road)).toBe(false);
    expect(matchesRoad("Gedimino pr.", null)).toBe(false);
    expect(matchesRoad("...", { names: ["Sinagogų g."] })).toBe(false);
  });
});
