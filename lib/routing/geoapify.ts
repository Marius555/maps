import "server-only";

import { GeoapifyError, geoapifyGet } from "@/lib/geoapify/client";
import { MAX_POLYGON_POINTS } from "@/lib/validation/shape.schema";
import type { LngLatTuple, RouteProfile } from "@/packages/shared/shapes";
import { RoutingError } from "./osrm";
import { simplifyPath } from "./simplify";
import type {
  NearestResult,
  RouteOutcome,
  RouteProvider,
  RouteRequest,
} from "./types";

/**
 * Geoapify adapter.
 *
 * The hosted answer to the problem `docs/self-hosting-routing.md` was written
 * about: the public OSRM demo server forbids reselling access and can withdraw
 * it without notice, so it cannot be in front of a paying customer. Geoapify
 * permits commercial use and — the property that actually decides it — permits
 * results to be stored and redistributed. This app bakes a route's geometry into
 * a static snapshot that customer sites read forever (CLAUDE.md §7), which is
 * precisely what Google's terms forbid and what Mapbox's published terms decline
 * to answer.
 *
 * Not in a visitor's path. A route is computed when its owner draws or
 * recalculates it and published as plain coordinates, so a map with a route on it
 * costs a visitor exactly what a map without one costs (§2).
 *
 * Selected by `ROUTING_PROVIDER=geoapify`; unset, `lib/routing/index.ts` builds
 * the OSRM adapter and nothing here runs. OSRM stays in the tree because
 * self-hosting is still the endgame if this pricing stops working.
 */

/**
 * Geoapify's own mode names.
 *
 * Unlike OSRM — which runs one process per profile, and is why the UI offers car
 * alone — all three come from one endpoint, so `bike` and `foot` would work today
 * if a control were added for them.
 */
const MODE: Record<RouteProfile, string> = {
  car: "drive",
  bike: "bicycle",
  foot: "walk",
};

export function createGeoapifyRouter(): RouteProvider {
  return {
    name: "geoapify",

    async route({ stops, profile }: RouteRequest): Promise<RouteOutcome> {
      if (stops.length < 2) return NO_ROUTE;

      const params = new URLSearchParams({
        /*
         * **`lat,lon`, and this is the one place in the codebase that order is
         * reversed.** Everything else here is an `LngLatTuple`, and the geocoding
         * endpoints take named `lat=`/`lon=` parameters that cannot be swapped by
         * accident. A route sent the other way round does not fail — it returns a
         * perfectly good route through somewhere else entirely.
         */
        waypoints: stops.map(([lng, lat]) => `${lat},${lng}`).join("|"),
        mode: MODE[profile],
        // Explicit, because the alternative is miles and `distanceM` would be
        // silently wrong by a factor of 1.6 rather than visibly broken.
        units: "metric",
      });

      const body = await ask<GeoapifyRouteResponse>("/v1/routing", params);

      return toRouteResult(body);
    },

    /**
     * How far the nearest road is, asked of the geocoder rather than the router.
     *
     * Geoapify has no `nearest` service — OSRM's, which is the same snapping a
     * route does to every coordinate, has no counterpart here. Reverse geocoding
     * restricted to streets answers a very slightly different question: how far
     * the nearest *named street in the address index* is, rather than the nearest
     * edge in the routing graph. The two disagree at the margins — an unnamed
     * service road is in one and not the other.
     *
     * That is acceptable because `ROUTE_SNAP_MAX_DISTANCE_M` is deliberately
     * generous (two kilometres, to keep a farm shop at the end of an unmapped
     * track), so the question being asked is "is this pin anywhere near the road
     * network at all", which both indexes agree about. The threshold itself stays
     * in ./routable.ts and is not duplicated into this request — no radius
     * parameter, so an empty answer means Geoapify found no street at all and
     * `isRoutableSnap` refuses it.
     */
    async nearest(point): Promise<NearestResult> {
      const [lng, lat] = point;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        type: "street",
        limit: "1",
      });

      const body = await ask<GeoapifyReverseResponse>("/v1/geocode/reverse", params);

      return toNearestResult(body);
    },
  };
}

/**
 * Geoapify's routing answer, narrowed to the parts we read.
 *
 * `geometry` is typed as both shapes because the documented one is
 * `MultiLineString` — an array of LineStrings, one per leg — and a single-leg
 * route is the case most likely to arrive as a plain `LineString`. Guessing
 * wrong in either direction yields an empty route rather than an error.
 */
export type GeoapifyRouteResponse = {
  features?: Array<{
    properties?: { distance?: number; time?: number };
    geometry?: {
      type?: string;
      coordinates?: number[][] | number[][][];
    };
  }>;
  /** Present instead of `features` when the request itself was refused. */
  statusCode?: number;
  error?: string;
  message?: string;
};

/** The reverse geocoder's answer, narrowed to the one field `nearest` reads. */
export type GeoapifyReverseResponse = {
  features?: Array<{ properties?: { distance?: number } }>;
  statusCode?: number;
  error?: string;
  message?: string;
};

/** No path, and nobody named a stop for it. */
const NO_ROUTE: RouteOutcome = { route: null, unreachableStop: null };

/**
 * Geoapify's answer, turned into ours.
 *
 * Exported and pure for the reason `toRouteResult` in ./osrm.ts is: it is the
 * whole behaviour of this adapter and it is unreachable through `route` without
 * a network round trip.
 *
 * **`unreachableStop` is always null here.** OSRM says which coordinate it could
 * not attach to a road, in prose, and ./osrm.ts reads the index out of that
 * sentence; Geoapify documents no equivalent, so a route that cannot be built
 * arrives as an ordinary refusal. The caller already handles null by falling back
 * to a message about the route rather than about one stop — and the probe above
 * is what actually prevents the case, by greying a pin before it is ever clicked.
 */
export function toRouteResult(body: GeoapifyRouteResponse): RouteOutcome {
  const first = body.features?.[0];
  if (!first) return NO_ROUTE;

  const points = flattenLegs(first.geometry?.coordinates);

  // Two points is the least a path can be. Fewer means a route with no geometry,
  // which is not something to store.
  if (points.length < 2) return NO_ROUTE;

  return {
    route: {
      points: simplifyPath(points, MAX_POLYGON_POINTS),
      // `time`, not `duration` — the one field name that differs from OSRM's, and
      // one that reads as zero rather than as an error if it is looked for by the
      // wrong name.
      durationS: Math.max(0, Math.round(first.properties?.time ?? 0)),
      distanceM: Math.max(0, Math.round(first.properties?.distance ?? 0)),
    },
    unreachableStop: null,
  };
}

/**
 * The legs of a route, joined into the one run of points the rest of the app
 * stores.
 *
 * Geoapify returns a `MultiLineString`: one LineString per pair of waypoints,
 * and **consecutive legs repeat the coordinate they meet at**. Left in, a
 * five-stop route carries four duplicated points into the snapshot — invisible
 * on a map and wasteful in a file with a point budget.
 *
 * The duplicate is dropped on exact equality rather than on a tolerance, because
 * the two copies are the same number serialised twice by the same engine. A near
 * miss is a genuine gap between legs and is kept, which is the honest reading:
 * swallowing a real discontinuity would draw a straight line across it and claim
 * it was a road.
 *
 * A plain `LineString` — a flat array of pairs — is accepted too, so a
 * single-leg response cannot silently come out empty.
 */
export function flattenLegs(
  coordinates: number[][] | number[][][] | undefined,
): LngLatTuple[] {
  if (!coordinates?.length) return [];

  const legs: number[][][] = Array.isArray(coordinates[0]?.[0])
    ? (coordinates as number[][][])
    : [coordinates as number[][]];

  const points: LngLatTuple[] = [];

  for (const leg of legs) {
    if (!Array.isArray(leg)) continue;

    for (const pair of leg) {
      if (!pair || pair.length < 2) continue;

      const [lng, lat] = pair;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

      const previous = points.at(-1);
      if (previous && previous[0] === lng && previous[1] === lat) continue;

      points.push([lng, lat]);
    }
  }

  return points;
}

/**
 * The reverse geocoder's answer, turned into a snap distance.
 *
 * No street within reach reads as null — the same thing OSRM's `NoSegment` means,
 * and the ordinary answer for a pin in the middle of a field rather than a
 * failure to answer.
 */
export function toNearestResult(body: GeoapifyReverseResponse): NearestResult {
  const distance = body.features?.[0]?.properties?.distance;
  if (typeof distance !== "number" || !Number.isFinite(distance)) return null;

  return { snapM: Math.max(0, Math.round(distance)) };
}

/**
 * One Geoapify request, with its failures translated into this folder's error.
 *
 * `lib/api/router-errors.ts` recognises `RoutingError` and re-throws anything
 * else as a bug, so a `GeoapifyError` reaching it would turn "the routing service
 * is busy" into a 500. The cause travels with it because `isTimeout` reads it.
 */
async function ask<T>(path: string, params: URLSearchParams): Promise<T> {
  try {
    return await geoapifyGet<T>(path, params);
  } catch (error) {
    if (error instanceof GeoapifyError) {
      throw new RoutingError(error.message, error.status, error.cause);
    }

    throw error;
  }
}
