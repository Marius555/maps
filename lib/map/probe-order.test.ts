import { describe, expect, it } from "vitest";

import { ROUTE_PROBE_LIMIT, probeOrder, type ProbeCandidate } from "./probe-order";

const CENTRE = { lat: 54.687, lng: 25.28 };

/** Roughly 1km of latitude per 0.009 degrees, which is close enough to rank by. */
function at(id: string, kmNorth: number, address = "Some street 1"): ProbeCandidate {
  return {
    id,
    address,
    lat: CENTRE.lat + kmNorth * 0.009,
    lng: CENTRE.lng,
  };
}

function ids(places: readonly ProbeCandidate[]): string[] {
  return places.map((place) => place.id);
}

describe("probeOrder", () => {
  it("puts address-less pins first, whatever the array said", () => {
    const places = [at("near", 1), at("far-but-blank", 40, ""), at("mid", 5)];

    expect(ids(probeOrder(places, CENTRE))).toEqual([
      "far-but-blank",
      "near",
      "mid",
    ]);
  });

  it("orders the rest by distance from the centre of the map", () => {
    const places = [at("far", 20), at("near", 1), at("mid", 6)];

    expect(ids(probeOrder(places, CENTRE))).toEqual(["near", "mid", "far"]);
  });

  it("includes pins that already have an address", () => {
    // The bug this replaced: the sweep asked only about address-less pins, so
    // on a geocoded map it asked about nothing and no pin ever greyed.
    const places = [at("geocoded", 2), at("imported", 3)];

    expect(ids(probeOrder(places, CENTRE))).toEqual(["geocoded", "imported"]);
  });

  it("stops at the ceiling", () => {
    const places = Array.from({ length: 500 }, (_, index) =>
      at(`p${String(index)}`, index + 1),
    );

    const order = probeOrder(places, CENTRE);

    expect(order).toHaveLength(ROUTE_PROBE_LIMIT);
    // The nearest ones, not the first ones the array happened to hold.
    expect(order[0].id).toBe("p0");
    expect(order.at(-1)?.id).toBe(`p${String(ROUTE_PROBE_LIMIT - 1)}`);
  });

  it("is stable for pins the same distance out", () => {
    const places = [at("b", 3), at("a", 3), at("c", 3)];

    expect(ids(probeOrder(places, CENTRE))).toEqual(["b", "a", "c"]);
  });

  it("asks about nothing at a ceiling of zero", () => {
    expect(probeOrder([at("a", 1)], CENTRE, 0)).toEqual([]);
  });
});
