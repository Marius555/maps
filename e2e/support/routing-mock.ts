import type { Page } from "@playwright/test";

export type RoutingMock = {
  /** How many times the editor asked for directions. */
  directionsCalls: () => number;
};

/**
 * Answers the route tool locally, in the routes' own shapes
 * (`app/api/maps/[id]/directions`, `…/routable`). The real ones spend a lookup
 * per stop and per pin on the account's allowance and a Geoapify credit each.
 *
 * - `routable`: every pin is on a road.
 * - `directions`: a straight line through the stops, 1km and 60s per leg —
 *   the editor draws whatever geometry it is handed, so a straight one is as
 *   good a test of the save as a real one.
 */
export async function mockRouting(page: Page): Promise<RoutingMock> {
  let calls = 0;

  await page.route("**/api/maps/*/routable", async (route) => {
    const { points } = route.request().postDataJSON() as { points: unknown[] };
    await route.fulfill({ json: { data: { results: points.map(() => true) } } });
  });

  await page.route("**/api/maps/*/directions", async (route) => {
    calls += 1;
    const { stops } = route.request().postDataJSON() as { stops: [number, number][] };
    const legs = Math.max(1, stops.length - 1);
    await route.fulfill({
      json: {
        data: {
          route: { points: stops, durationS: 60 * legs, distanceM: 1000 * legs },
          unreachableStop: null,
        },
      },
    });
  });

  return { directionsCalls: () => calls };
}
