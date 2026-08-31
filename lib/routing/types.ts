import type { LngLatTuple, RouteProfile } from "@/packages/shared/shapes";

/**
 * What a routing engine is, to the rest of the app.
 *
 * Provider-agnostic for the reason /lib/geocoding is (CLAUDE.md §7): the public
 * OSRM demo instance is a development convenience with no uptime guarantee and
 * terms that forbid serving paying customers from it, so the engine behind this
 * interface is expected to change. Nothing outside this folder may import a
 * provider directly.
 *
 * Deliberately without `server-only`, like ./types.ts's counterpart in
 * /lib/geocoding: the client sends these shapes and vitest reads them, and
 * neither can import a module that refuses to load outside a server bundle.
 */

export type RouteRequest = {
  /** 2..N waypoints in order, [lng, lat]. */
  stops: LngLatTuple[];
  profile: RouteProfile;
};

export type RouteResult = {
  /**
   * The path, snapped to roads and already simplified to fit the snapshot's
   * point cap — see ./simplify.ts. [lng, lat], the order the rest of the app
   * stores geometry in.
   */
  points: LngLatTuple[];
  /** Seconds. The one number the geometry cannot yield back. */
  durationS: number;
  /**
   * Metres, as the engine reported them.
   *
   * Not stored and not published — a line's length is measured from its own
   * points wherever it is drawn (packages/shared/geo.ts). Carried here only so
   * the editor can say whether simplification moved the number, which is the
   * one place the two can be compared.
   */
  distanceM: number;
};

/**
 * What came back from asking for a route: the path, or the reason there is none.
 *
 * A pair rather than a nullable result, because "no route" has two genuinely
 * different causes and only one of them is anybody's fault. The engine can snap
 * every stop to a road and still find no way between them — an island, a closed
 * border — which is a real answer about the *journey*. Or it can fail to attach
 * one particular coordinate to any road at all, which is an answer about that
 * *stop*, and the only useful thing to say is which one.
 *
 * `unreachableStop` is an index into the request's own `stops`, so the caller can
 * name the location the user clicked rather than describing the route as a whole.
 * Null whenever the engine did not say — including every successful route.
 */
export type RouteOutcome = {
  /** Null when the engine answered but found no route between the stops. */
  route: RouteResult | null;
  /** Index of the stop the engine could not attach to a road, when it named one. */
  unreachableStop: number | null;
};

/**
 * How far a coordinate is from the nearest road the engine knows about.
 *
 * Null when there is no road at all within reach — the same condition that makes
 * a route fail with `NoSegment`, asked one stop at a time and *before* anybody
 * draws anything. See ./routable.ts for what counts as near enough.
 */
export type NearestResult = { snapM: number } | null;

export type RouteProvider = {
  name: string;
  route(request: RouteRequest): Promise<RouteOutcome>;
  /**
   * Whether a single point can be a stop, and how far it would be dragged onto
   * the road network to become one.
   *
   * Separate from `route` because it answers a question about one location
   * rather than about a journey, and because it is the only way to know before a
   * click. Costs one request per point on whatever engine is configured, at edit
   * time only — never in a visitor's path (CLAUDE.md §2).
   */
  nearest(point: LngLatTuple, profile: RouteProfile): Promise<NearestResult>;
};
