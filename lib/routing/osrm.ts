import "server-only";

import { createThrottle } from "@/lib/geocoding/throttle";
import { MAX_POLYGON_POINTS } from "@/lib/validation/shape.schema";
import type { LngLatTuple, RouteProfile } from "@/packages/shared/shapes";
import { simplifyPath } from "./simplify";
import type {
  NearestResult,
  RouteOutcome,
  RouteProvider,
  RouteRequest,
} from "./types";

/**
 * OSRM adapter.
 *
 * OSRM is the engine we intend to self-host; pointing `ROUTING_URL` at that
 * instance is the only change needed, because the API is identical.
 *
 * **The default endpoint is for development only.** `router.project-osrm.org`
 * is the project's demo server: roughly one request per second, no quality or
 * uptime guarantee, an identifying User-Agent required, reselling forbidden, and
 * access that "shall be withdrawn at any time and without giving a reason" —
 * with commercial users warned in as many words that they may stop being able to
 * serve their paying customers. That is the same trap CLAUDE.md §12 records for
 * Nominatim, and it has the same answer: self-host before the first paying
 * customer. See docs/self-hosting-routing.md.
 *
 * None of this is in a visitor's path. A route is computed when its owner draws
 * or recalculates it, baked into the shape, and published as plain geometry —
 * CLAUDE.md §2, and the whole reason routes can exist here at all.
 */

const DEFAULT_ENDPOINT = "https://router.project-osrm.org";

/** ~1 req/sec, the demo server's stated pace. A self-hosted one can take far more. */
const DEFAULT_MIN_INTERVAL_MS = 1000;

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Public OSM-derived services block unidentified clients, and Node's default is
 * exactly that — a 403 from a WAF is otherwise indistinguishable from the
 * service being down. Same reasoning as the geocoder's.
 */
const DEFAULT_USER_AGENT =
  "custom-map-builder/1.0 (embeddable store locator; routing at edit time only)";

/** One retry, for failures a second attempt can plausibly fix. */
const RETRY_BACKOFF_MS = 400;

/**
 * OSRM's own profile names.
 *
 * Its URL segment is the *profile the instance was built with*, not a choice —
 * a car instance answers `/driving` and 400s on anything else. Only `car` is
 * offered by the UI for that reason; the other two are here so a self-hosted
 * Valhalla or a second OSRM process needs no change in this file.
 */
const PROFILE_PATH: Record<RouteProfile, string> = {
  car: "driving",
  bike: "cycling",
  foot: "walking",
};

export function createOsrmProvider(options?: {
  endpoint?: string;
  minIntervalMs?: number;
  userAgent?: string;
}): RouteProvider {
  const endpoint = (
    options?.endpoint ??
    process.env.ROUTING_URL ??
    DEFAULT_ENDPOINT
  ).replace(/\/$/, "");

  const userAgent =
    options?.userAgent ?? process.env.ROUTING_USER_AGENT ?? DEFAULT_USER_AGENT;

  const throttle = createThrottle(
    options?.minIntervalMs ?? readInterval() ?? DEFAULT_MIN_INTERVAL_MS,
  );

  return {
    name: "osrm",

    async route({ stops, profile }: RouteRequest): Promise<RouteOutcome> {
      if (stops.length < 2) return NO_ROUTE;

      const path = stops.map(([lng, lat]) => `${lng},${lat}`).join(";");
      const url = new URL(`${endpoint}/route/v1/${PROFILE_PATH[profile]}/${path}`);

      /*
       * GeoJSON rather than `polyline6`, which is roughly four times smaller on
       * the wire. This runs on the server at edit time, never in a visitor's
       * request, so the bytes cost nothing — and a decoder is a thing that can
       * be subtly wrong in a way no test written from the same misunderstanding
       * would catch.
       */
      url.searchParams.set("geometries", "geojson");
      // Full detail, then thinned by our own simplifier. OSRM's `simplified`
      // overview uses its own tolerance, which a long route still overruns.
      url.searchParams.set("overview", "full");
      url.searchParams.set("steps", "false");
      url.searchParams.set("alternatives", "false");

      const body = await fetchOsrm(url, throttle, userAgent);

      return toRouteResult(body);
    },

    /*
     * OSRM's `nearest` service, which is the same snapping `route` does to every
     * coordinate before it plans anything — asked on its own, about one point.
     *
     * `number=1` because the only thing being asked is whether there is a road
     * and how far it is; the alternatives OSRM would offer are for map matching.
     * A `NoSegment` here is the ordinary answer for a point with no road near it,
     * not a failure, so it reads as null rather than throwing.
     */
    async nearest(point, profile): Promise<NearestResult> {
      const [lng, lat] = point;
      const url = new URL(
        `${endpoint}/nearest/v1/${PROFILE_PATH[profile]}/${lng},${lat}`,
      );
      url.searchParams.set("number", "1");

      const body = await fetchOsrm(url, throttle, userAgent);

      return toNearestResult(body);
    },
  };
}

type Throttle = <T>(task: () => Promise<T>) => Promise<T>;

/** OSRM's response, narrowed to the parts we read. */
export type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { type?: string; coordinates?: number[][] };
  }>;
  /** `nearest` only: the snapped candidates, closest first. */
  waypoints?: Array<{ distance?: number }>;
};

/** No path, and nobody named a stop for it — the shape of most refusals. */
const NO_ROUTE: RouteOutcome = { route: null, unreachableStop: null };

/**
 * OSRM's answer, turned into ours.
 *
 * Exported and pure, because it is the whole behaviour of this adapter and it is
 * not reachable through `route` without a network round trip — the same split
 * `formatLabel` and `toAddressParts` make in the geocoder.
 *
 * Neither `NoRoute` nor `NoSegment` is a failure, and they are not the same
 * answer either. `NoRoute` means every stop snapped to a road and there is still
 * no way to drive between them. `NoSegment` means one particular coordinate has
 * no road near it at all — and OSRM says which, in prose, which is the only
 * place that fact exists. Losing it was the whole reason a route through a pin
 * in the middle of a field failed with a message naming no pin.
 *
 * Anything else non-`Ok` is the engine refusing the question and throws, so the
 * route handler can say so rather than showing an empty result.
 */
export function toRouteResult(body: OsrmResponse): RouteOutcome {
  if (body.code === "NoSegment") {
    return { route: null, unreachableStop: noSegmentIndex(body.message) };
  }

  if (body.code === "NoRoute") return NO_ROUTE;

  if (body.code && body.code !== "Ok") {
    throw new RoutingError(`OSRM answered ${body.code}`, undefined);
  }

  const first = body.routes?.[0];
  if (!first) return NO_ROUTE;

  const coordinates = first.geometry?.coordinates ?? [];

  const points: LngLatTuple[] = [];
  for (const pair of coordinates) {
    if (!pair || pair.length < 2) continue;

    const [lng, lat] = pair;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    points.push([lng, lat]);
  }

  // Two points is the least a path can be. Fewer means the engine returned a
  // route with no geometry, which is not something to store.
  if (points.length < 2) return NO_ROUTE;

  return {
    route: {
      points: simplifyPath(points, MAX_POLYGON_POINTS),
      durationS: Math.max(0, Math.round(first.duration ?? 0)),
      distanceM: Math.max(0, Math.round(first.distance ?? 0)),
    },
    unreachableStop: null,
  };
}

/**
 * Which stop OSRM could not put on a road, read out of the sentence it says so
 * in: "Could not find a matching segment for coordinate 3".
 *
 * Parsing prose is not something to do lightly, and it is done here because the
 * index is in no other field — the alternative is telling the user that one of
 * their stops is unreachable without being able to say which, which is the bug
 * this exists to fix. It fails safe in both directions: a message in a shape we
 * do not recognise yields null and the caller falls back to the general
 * message, and an index is only ever used to look up a stop the caller already
 * has, so a wrong one cannot reach further than a wrong name in a toast.
 *
 * Anchored to the end of the string, because "coordinate" appears nowhere else
 * in the message and a bare "first integer" would find the wrong one if it ever
 * did.
 */
export function noSegmentIndex(message?: string): number | null {
  const match = /coordinate\s+(\d+)\s*$/i.exec(message?.trim() ?? "");
  if (!match) return null;

  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/**
 * OSRM's `nearest` answer, turned into ours.
 *
 * Pure and exported for `toRouteResult`'s reason. `NoSegment` is the ordinary
 * answer for a point with no road within reach and reads as null — that is the
 * whole question being asked, not a failure to answer it.
 */
export function toNearestResult(body: OsrmResponse): NearestResult {
  if (body.code === "NoSegment") return null;

  if (body.code && body.code !== "Ok") {
    throw new RoutingError(`OSRM answered ${body.code}`, undefined);
  }

  const distance = body.waypoints?.[0]?.distance;
  if (typeof distance !== "number" || !Number.isFinite(distance)) return null;

  return { snapM: Math.max(0, Math.round(distance)) };
}

/**
 * One paced, retried request to whichever OSRM service the URL names.
 *
 * Shared by `route` and `nearest` rather than duplicated, and that sharing is
 * the point: both go through the *same* throttle instance, so probing a pin's
 * routability can never jump the queue in front of a route somebody is waiting
 * on, and the demo server sees one client keeping to one pace.
 */
async function fetchOsrm(
  url: URL,
  throttle: Throttle,
  userAgent: string,
): Promise<OsrmResponse> {
  try {
    return await throttle(() => requestOsrm(url, userAgent));
  } catch (error) {
    if (!isRetryable(error)) throw error;

    await sleep(RETRY_BACKOFF_MS);

    // Back through the throttle, so the retry takes its own slot rather than
    // jumping ahead of whoever arrived while we were failing.
    return throttle(() => requestOsrm(url, userAgent));
  }
}

async function requestOsrm(url: URL, userAgent: string): Promise<OsrmResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
      // Routing happens when the owner draws or recalculates, never when a
      // visitor loads the map (§2).
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": userAgent },
    });
  } catch (error) {
    // DNS failures, refused connections and TLS errors reject as a bare
    // `TypeError: fetch failed`. Wrapped so every upstream failure arrives as
    // one type, with the cause kept so a timeout stays recognisable.
    throw new RoutingError("Could not reach the routing engine", undefined, error);
  }

  if (!response.ok) {
    throw new RoutingError(`OSRM returned ${response.status}`, response.status);
  }

  return (await response.json()) as OsrmResponse;
}

/**
 * Worth a second attempt: unreachable, or one of the engine's own gateway
 * errors. A 4xx fails identically twice, and retrying a 429 is the one thing
 * guaranteed to make it worse.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof RoutingError)) return false;
  if (isTimeout(error)) return false;

  return error.status === undefined || error.status >= 500;
}

/** True for our own 8s abort, however the runtime chose to wrap it. */
export function isTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError") return true;

  const cause = error.cause;
  return cause instanceof Error && cause.name === "TimeoutError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** An unset or non-numeric value falls through to the default, not to NaN. */
function readInterval(): number | undefined {
  const raw = process.env.ROUTING_MIN_INTERVAL_MS;
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Thrown for an upstream failure, so the route can tell it from a bad request.
 *
 * `status` is the engine's own, undefined when we never got an answer at all —
 * the two need telling apart both for what we log and for what we retry.
 */
export class RoutingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RoutingError";
  }
}
