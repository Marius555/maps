import { z } from "zod";

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
export type GeocodeBatchInput = z.infer<typeof geocodeBatchSchema>;
