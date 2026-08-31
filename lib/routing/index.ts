import "server-only";

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

export function getRouter(): RouteProvider {
  provider ??= createOsrmProvider();
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
