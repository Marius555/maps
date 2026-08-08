import { z } from "zod";

import { latSchema, lngSchema } from "./common";

export const GEOCODE_STATUSES = ["ok", "low", "failed", "manual"] as const;
export const geocodeStatusSchema = z.enum(GEOCODE_STATUSES);
export type GeocodeStatus = z.infer<typeof geocodeStatusSchema>;

/**
 * Optional contact fields accept the empty string as well as a valid value.
 * The columns are plain varchar because Appwrite's native email/url types reject
 * "" — which would fail every location saved without contact details.
 */
const optionalEmail = z.union([z.email("Enter a valid email address."), z.literal("")]);
const optionalUrl = z.union([z.url("Enter a valid URL, including https://"), z.literal("")]);

export const createPlaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the location a name.")
    .max(255, "Keep the name under 255 characters."),
  lat: latSchema,
  lng: lngSchema,
  // Empty until Week 2's geocoding fills it in. Dropping a pin gives us
  // coordinates and nothing else.
  address: z.string().trim().max(512).default(""),
  category: z.string().trim().max(64).default(""),
  description: z.string().max(5000).optional(),
  phone: z.string().trim().max(32).optional(),
  email: optionalEmail.optional(),
  url: optionalUrl.optional(),
  sortOrder: z.number().int().min(0).default(0),
  geocodeStatus: geocodeStatusSchema.default("manual"),
});

export const updatePlaceSchema = z
  .object({
    name: z.string().trim().min(1, "Give the location a name.").max(255),
    lat: latSchema,
    lng: lngSchema,
    address: z.string().trim().max(512),
    category: z.string().trim().max(64),
    description: z.string().max(5000),
    phone: z.string().trim().max(32),
    email: optionalEmail,
    url: optionalUrl,
    sortOrder: z.number().int().min(0),
    geocodeStatus: geocodeStatusSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to save.");

/**
 * What the edit form holds.
 *
 * Distinct from `updatePlaceSchema`, which is `.partial()` so a PATCH can carry
 * one field. A form always has every field, and `.partial()` would make each one
 * `string | undefined` — every input would then need a non-null assertion.
 */
export const placeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the location a name.")
    .max(255, "Keep the name under 255 characters."),
  address: z.string().trim().max(512),
  category: z.string().trim().max(64),
  description: z.string().max(5000),
  phone: z.string().trim().max(32),
  email: optionalEmail,
  url: optionalUrl,
  lat: latSchema,
  lng: lngSchema,
});

export type PlaceFormValues = z.infer<typeof placeFormSchema>;

/**
 * Import confirm payload.
 *
 * Capped per request so a 3,000-row Pro import arrives as several calls rather
 * than one payload large enough to hit a body-size limit. The client chunks; the
 * plan limit is still checked against the map's real total on every chunk.
 */
export const MAX_BULK_PLACES = 200;

export const bulkCreatePlacesSchema = z.object({
  places: z
    .array(createPlaceSchema)
    .min(1, "Nothing to import.")
    .max(MAX_BULK_PLACES, `Send at most ${MAX_BULK_PLACES} locations at a time.`),
});

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;
export type BulkCreatePlacesInput = z.infer<typeof bulkCreatePlacesSchema>;
