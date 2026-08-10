import { z } from "zod";

import { latSchema, lngSchema } from "./common";

/**
 * A single request per batch is capped deliberately.
 *
 * The provider is paced at roughly one request a second, so a 500-row CSV cannot
 * be one HTTP call — it would sit past every sensible request timeout. The client
 * walks the file in chunks and reports progress instead.
 */
export const MAX_GEOCODE_BATCH = 10;

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
});

export type GeocodeSearchInput = z.infer<typeof geocodeSearchSchema>;
export type ReverseGeocodeInput = z.infer<typeof reverseGeocodeSchema>;
export type GeocodeBatchInput = z.infer<typeof geocodeBatchSchema>;
