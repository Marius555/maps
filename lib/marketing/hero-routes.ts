import type { LngLatTuple } from "@/packages/shared/shapes";

import { HERO_ROUTE_DATA, HERO_ROUTE_ENGINE } from "./hero-routes.data";

/**
 * The roads between "you are here" and the pins the hero's "Nearest to me" can
 * land on — measured once, in development, and committed.
 *
 * **Baked because CLAUDE.md §2 is the product.** The landing page is the most
 * visited page we have, and a route asked for when a visitor presses a button
 * is a metered call in a visitor's path — the one thing this whole codebase is
 * arranged to avoid. So the hero does what a published map does: the geometry
 * was worked out once by the routing engine and is read from a file forever
 * after. Pressing the button makes no request at all.
 *
 * It is also the honest version of the claim the Key section makes two screens
 * below — "a route carries its real distance and drive time, measured once,
 * when you drew it". The line drawn here *is* that, on the same roads, from the
 * same engine.
 *
 * ### Making it again
 *
 * `npm run dev`, then either press **Generate routes** on `/dev/hero-map` and
 * save the download over `hero-routes.data.ts`, or:
 *
 * ```
 * curl -s http://localhost:3000/dev/hero-routes > lib/marketing/hero-routes.data.ts
 * ```
 *
 * Needed whenever `HERO_PINS`, `HERO_YOU_ARE_HERE` or the filter chips change
 * what "nearest" can answer. **Nothing breaks if you forget** — `heroRouteTo`
 * returns null for a pin it has never heard of and the map falls back to the
 * straight line it drew before. That is the whole reason the lookup is a
 * function rather than an index.
 */

export type HeroRoute = {
  /** The pin this route ends at, by its `HERO_PINS` name. */
  to: string;
  /** [lng, lat], "you are here" first, already thinned. */
  points: LngLatTuple[];
  /** Metres and seconds, as the engine reported them. */
  distanceM: number;
  durationS: number;
};

/**
 * The most points a baked route keeps.
 *
 * Forty-eight over a few kilometres of London is a point every eighty metres or
 * so, which is finer than a 1,440px-wide picture of the whole city can draw —
 * and three routes at that size is about two kilobytes of module. The engine's
 * own answer is nearer a thousand points, all of which would ship to every
 * visitor to say nothing visible (see lib/routing/simplify.ts).
 */
export const HERO_ROUTE_MAX_POINTS = 48;

const ROUTE_ENGINE_CREDIT: Record<string, string> = {
  geoapify:
    'Routing by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>',
  osrm: 'Routing by <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM</a>',
};

/**
 * Credit for the engine that measured the baked routes, as HTML, or "" when
 * there is nothing baked to credit.
 *
 * Geoapify's free plan requires it (CLAUDE.md §12) and a route drawn on it is
 * published here, on the most public page we have — so the credit is derived
 * from the generated data rather than written by hand, and switching
 * `ROUTING_PROVIDER` and regenerating changes it with the geometry.
 */
export const HERO_ROUTE_CREDIT =
  Object.keys(HERO_ROUTE_DATA).length === 0
    ? ""
    : (ROUTE_ENGINE_CREDIT[HERO_ROUTE_ENGINE] ??
      `Routing by ${HERO_ROUTE_ENGINE}`);

/** The route to `name`, or null if there is none baked for it. */
export function heroRouteTo(name: string | null | undefined): HeroRoute | null {
  if (!name) return null;

  return HERO_ROUTE_DATA[name] ?? null;
}
