import { describe, expect, it } from "vitest";

import {
  HERO_KIND_ORDER,
  HERO_PINS,
  HERO_YOU_ARE_HERE,
  matchesFilter,
  nearestPin,
  type HeroFilter,
} from "./hero-map";
import { HERO_ROUTE_MAX_POINTS, heroRouteTo } from "./hero-routes";
import { distanceKm } from "@/packages/shared/geo";

const FILTERS: HeroFilter[] = ["all", ...HERO_KIND_ORDER];

function nearestFor(filter: HeroFilter) {
  return nearestPin(
    HERO_YOU_ARE_HERE,
    HERO_PINS.filter((pin) => matchesFilter(pin, filter)),
  )?.pin;
}

/**
 * The hero's routes are generated and committed, and the one way they go wrong
 * is silently: move a pin, forget `/dev/hero-routes`, and "Nearest to me" falls
 * back to the straight line it used to draw. Nothing throws and the page looks
 * almost right.
 *
 * So this is the seam — what the filter chips can ask for, against what the
 * file actually holds.
 */
describe("hero routes", () => {
  it("has a route for every pin the filters can call nearest", () => {
    for (const filter of FILTERS) {
      const pin = nearestFor(filter);

      expect(pin, `no nearest pin for ${filter}`).toBeDefined();
      expect(heroRouteTo(pin!.name), `regenerate: no route to ${pin!.name}`).not.toBeNull();
    }
  });

  it("starts at the visitor and ends at the pin", () => {
    for (const filter of FILTERS) {
      const pin = nearestFor(filter)!;
      const route = heroRouteTo(pin.name)!;
      const [first] = route.points;
      const last = route.points[route.points.length - 1];

      // Both ends are snapped to a road, so they are near rather than exact —
      // a quarter of a kilometre is well inside "the same street".
      expect(distanceKm(HERO_YOU_ARE_HERE, { lng: first[0], lat: first[1] })).toBeLessThan(0.25);
      expect(distanceKm(pin, { lng: last[0], lat: last[1] })).toBeLessThan(0.25);
    }
  });

  it("is longer by road than in a straight line, and not absurdly so", () => {
    for (const filter of FILTERS) {
      const pin = nearestFor(filter)!;
      const route = heroRouteTo(pin.name)!;
      const straightM = distanceKm(HERO_YOU_ARE_HERE, pin) * 1000;

      expect(route.distanceM).toBeGreaterThan(straightM);
      expect(route.distanceM).toBeLessThan(straightM * 3);
      expect(route.durationS).toBeGreaterThan(0);
    }
  });

  it("keeps every route inside the point budget", () => {
    for (const filter of FILTERS) {
      const route = heroRouteTo(nearestFor(filter)!.name)!;

      expect(route.points.length).toBeGreaterThan(2);
      expect(route.points.length).toBeLessThanOrEqual(HERO_ROUTE_MAX_POINTS);
    }
  });

  it("answers null for a pin it has never heard of", () => {
    expect(heroRouteTo("Atlantis")).toBeNull();
    expect(heroRouteTo(null)).toBeNull();
  });
});
