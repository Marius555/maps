import "server-only";

import { createGeoapifyRouter } from "./geoapify";
import { createOsrmProvider } from "./osrm";
import type { RouteProvider } from "./types";

/**
 * The only way the app gets a routing engine.
 *
 * One instance per process keeps the throttle meaningful — a new provider per
 * request would give every request its own empty queue and defeat the pacing.
 * Same reasoning, same shape as lib/geocoding/index.ts.
 */
let provider: RouteProvider | null = null;

/**
 * `ROUTING_PROVIDER=geoapify` moves routing onto Geoapify; anything else, unset
 * included, keeps the OSRM adapter and every existing behaviour byte-identical.
 *
 * An explicit switch rather than "is there a key" — the same account's key also
 * drives geocoding, and a stray value in `.env` must not silently reroute an
 * engine nobody meant to move. It is also what keeps OSRM reachable, which
 * matters because self-hosting is still the endgame if this pricing stops
 * working (docs/self-hosting-routing.md).
 */
export function getRouter(): RouteProvider {
  provider ??=
    process.env.ROUTING_PROVIDER === "geoapify"
      ? createGeoapifyRouter()
      : createOsrmProvider();

  return provider;
}

export { RoutingError, isRetryable, isTimeout } from "./osrm";
export type {
  NearestResult,
  RouteOutcome,
  RouteProvider,
  RouteRequest,
  RouteResult,
} from "./types";
export { isRoutableSnap, ROUTE_SNAP_MAX_DISTANCE_M } from "./routable";
