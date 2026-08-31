import { z } from "zod";

import { MIN_LINE_POINTS } from "@/packages/shared/shapes";
import { latSchema, lngSchema } from "./common";
import { MAX_ROUTE_STOPS, ROUTE_PROFILES } from "./shape.schema";

/**
 * What may be asked of the routing engine.
 *
 * Coordinates and a profile, and nothing else — in particular **never a URL**.
 * The endpoint is composed in lib/routing/osrm.ts from a literal host and the
 * `ROUTING_URL` environment variable; accepting one here would make this a proxy
 * for anything the caller can name, which is the rule the Google Sheet import
 * route already spells out.
 *
 * The stop cap is the engine's, not ours — see MAX_ROUTE_STOPS.
 */
export const directionsSchema = z.object({
  stops: z
    .array(z.tuple([lngSchema, latSchema]))
    .min(MIN_LINE_POINTS, "A route needs at least two stops.")
    .max(MAX_ROUTE_STOPS, `A route can have up to ${MAX_ROUTE_STOPS} stops.`),
  profile: z.enum(ROUTE_PROFILES).default("car"),
});

export type DirectionsInput = z.output<typeof directionsSchema>;
