import { z } from "zod";

import { latSchema, lngSchema } from "./common";
import { ROUTE_PROFILES } from "./shape.schema";

/**
 * What may be asked about whether a location can be a stop.
 *
 * Coordinates and a profile, and **never a URL**, for exactly the reason
 * directions.schema.ts spells out: the endpoint is composed from a literal host
 * and `ROUTING_URL`, and accepting one here would turn this into a proxy for
 * anything a caller can name.
 *
 * The batch cap is a cost decision rather than an engine limit. Each point is
 * its own request to the engine, paced by the same throttle a route goes
 * through — a default of one per second on the public demo server — so a batch
 * is a promise about how long one request may hold a connection open. Twenty
 * five is the route stop cap, which is the largest set the client ever needs to
 * ask about at once (the stops of a route that failed).
 */
export const MAX_ROUTABLE_POINTS = 25;

export const routableSchema = z.object({
  points: z
    .array(z.tuple([lngSchema, latSchema]))
    .min(1, "Ask about at least one location.")
    .max(
      MAX_ROUTABLE_POINTS,
      `Up to ${MAX_ROUTABLE_POINTS} locations can be checked at once.`,
    ),
  profile: z.enum(ROUTE_PROFILES).default("car"),
});

export type RoutableInput = z.output<typeof routableSchema>;
