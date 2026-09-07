import { z } from "zod";

import { latSchema, lngSchema } from "./common";

/**
 * A single request per batch is capped deliberately.
 *
 * A whole file cannot be one HTTP call — paced at the provider's own interval it
 * would sit past every sensible request timeout — so the client walks the file
 * in chunks and reports progress instead.
 *
 * **25, raised from 10.** Ten was chosen against Photon's one-request-a-second
 * pace, where a chunk was already ten seconds of held-open function. At
 * Geoapify's spacing a chunk of 25 is around six seconds, comfortably inside the
 * 60s `maxDuration` the route now declares, and it cuts a three-thousand-row
 * import from three hundred round trips to a hundred and twenty. The number is a
 * function of the pace and the timeout, so moving `GEOAPIFY_MIN_INTERVAL_MS` a
 * long way is the thing that should make anyone revisit it.
 */
export const MAX_GEOCODE_BATCH = 25;

export const geocodeSearchSchema = z.object({
  address: z
    .string()
    .trim()
    .min(3, "Enter at least three characters to search for.")
    .max(512, "That address is too long to search for."),
  countryCode: z
    .string()
    .trim()
    .length(2, "Use a two-letter country code, like DE.")
    .optional(),
});

/**
 * Coordinates → address, for a pin the user has just dropped or dragged.
 *
 * `road` is what the editor measured against the basemap tiles it had already
 * drawn — the street the pin is genuinely standing on. The geocoder cannot
 * derive it (see lib/map/nearest-road.ts), and it is optional because plenty of
 * callers have no map: a CSV import has coordinates and nothing else.
 *
 * Bounded like any other client input. The names come from a vector tile rather
 * than from a text field, but they still arrive over HTTP and are still a
 * stranger's to send.
 */
export const reverseGeocodeSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  road: z
    .object({
      names: z.array(z.string().trim().min(1).max(255)).min(1).max(8),
      distanceM: z.number().min(0).max(100_000),
    })
    .nullish(),
});

export const geocodeBatchSchema = z.object({
  rows: z
    .array(
      z.object({
        /** Client-side row id. Echoed back so results reattach to their row. */
        key: z.string().trim().min(1).max(64),
        address: z.string().trim().max(512),
      }),
    )
    .min(1, "Nothing to geocode.")
    .max(MAX_GEOCODE_BATCH, `Send at most ${MAX_GEOCODE_BATCH} rows at a time.`),
  countryCode: z.string().trim().length(2).optional(),
  /**
   * How many locations this whole import intends to create — not how many rows
   * are in *this* chunk.
   *
   * The plan check on this endpoint used to be `existing + rows.length > limit`,
   * which for a chunk is a test almost nothing fails: a free map with ten empty
   * slots has room for any ten rows, so all three thousand were geocoded and the
   * refusal arrived at insert time with every request already spent. Checked
   * against the run's total instead, the first chunk is refused.
   *
   * Still the client's own number, so it is not a bound on a hostile caller —
   * that needs a durable per-user counter, which is the note left in the route
   * handler. It is a bound on the ordinary case, which is the one that was
   * spending real money.
   */
  runTotal: z.number().int().min(1).max(100_000).optional(),
});

export type GeocodeSearchInput = z.infer<typeof geocodeSearchSchema>;
export type ReverseGeocodeInput = z.infer<typeof reverseGeocodeSchema>;
export type GeocodeBatchInput = z.infer<typeof geocodeBatchSchema>;
