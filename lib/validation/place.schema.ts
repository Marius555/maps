import { z } from "zod";

import { DAYS_IN_WEEK } from "@/packages/shared/hours";
import { latSchema, lngSchema, pinIconRefSchema } from "./common";
import { groupIdSchema } from "./group.schema";

export const GEOCODE_STATUSES = ["ok", "low", "failed", "manual"] as const;
export const geocodeStatusSchema = z.enum(GEOCODE_STATUSES);
export type GeocodeStatus = z.infer<typeof geocodeStatusSchema>;

/**
 * How sure the geocoder was, 0–1. Null when nobody asked it.
 *
 * Separate from `geocodeStatus` because they describe different things, and a
 * dropped pin is where that stops being pedantic: its status is "manual" — a
 * person put it there and no later pass may move it — while its *address* was
 * derived, and might only be street-accurate. One field cannot say both.
 */
export const geocodeConfidenceSchema = z.number().min(0).max(1).nullable();

/**
 * The geocoder's answer in parts, kept instead of thrown away.
 *
 * Everything used to be flattened into the one `address` line, which meant the
 * postcode existed for exactly as long as it took to build that string. Now the
 * list can show it under the street, and anything else here — country code for a
 * flag, `osm*` to trace a row back to the object it came from — is available
 * without asking the geocoder a second time.
 *
 * Every field is optional because every one of them genuinely is: Photon answers
 * with whatever OSM has, and rural addresses routinely have no house number and
 * no postcode. `.catchall` keeps fields a future provider adds rather than
 * silently dropping them on the way to the database.
 */
export const addressPartsSchema = z
  .object({
    housenumber: z.string().max(64).optional(),
    street: z.string().max(255).optional(),
    postcode: z.string().max(32).optional(),
    city: z.string().max(128).optional(),
    district: z.string().max(128).optional(),
    state: z.string().max(128).optional(),
    country: z.string().max(128).optional(),
    countryCode: z.string().max(8).optional(),
    /** The POI's own name, when the match was a named venue rather than a plot. */
    name: z.string().max(255).optional(),
    osmType: z.string().max(8).optional(),
    osmId: z.number().optional(),
  })
  .catchall(z.unknown())
  .nullable();

export type AddressParts = NonNullable<z.infer<typeof addressPartsSchema>>;

/**
 * Opening hours, as the form holds them and the API accepts them.
 *
 * Fixed length rather than a sparse map: the form renders seven rows whatever the
 * data says, and a fixed array is what lets a row bind to `hours.3` directly.
 * `null` is a closed day; the shape itself is documented in
 * packages/shared/hours.ts.
 *
 * Times are validated as "HH:MM" here rather than reused from `isValidTime` so
 * that the message is a sentence the user can act on (§8), which a boolean
 * predicate cannot carry.
 */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM, like 09:00.");

export const dayHoursSchema = z
  .object({ open: timeSchema, close: timeSchema })
  .nullable();

export const openingHoursSchema = z
  .array(dayHoursSchema)
  .length(DAYS_IN_WEEK, "Opening hours must cover all seven days.");

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
  icon: pinIconRefSchema.default(""),
  description: z.string().max(5000).optional(),
  phone: z.string().trim().max(32).optional(),
  email: optionalEmail.optional(),
  url: optionalUrl.optional(),
  hours: openingHoursSchema.nullish(),
  sortOrder: z.number().int().min(0).default(0),
  geocodeStatus: geocodeStatusSchema.default("manual"),
  // Optional rather than defaulted: most creates have no geocoder behind them
  // at all, and `.default(null)` would make every caller state that in full.
  geocodeConfidence: geocodeConfidenceSchema.optional(),
  addressParts: addressPartsSchema.optional(),
  // Optional, not defaulted: nothing is created into a group. A location joins
  // one afterwards, by being dragged onto a row or caught by a marquee.
  groupId: groupIdSchema.optional(),
});

export const updatePlaceSchema = z
  .object({
    name: z.string().trim().min(1, "Give the location a name.").max(255),
    lat: latSchema,
    lng: lngSchema,
    address: z.string().trim().max(512),
    category: z.string().trim().max(64),
    icon: pinIconRefSchema,
    description: z.string().max(5000),
    phone: z.string().trim().max(32),
    email: optionalEmail,
    url: optionalUrl,
    hours: openingHoursSchema.nullable(),
    sortOrder: z.number().int().min(0),
    geocodeStatus: geocodeStatusSchema,
    geocodeConfidence: geocodeConfidenceSchema,
    addressParts: addressPartsSchema,
    groupId: groupIdSchema,
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
  icon: pinIconRefSchema,
  description: z.string().max(5000),
  phone: z.string().trim().max(32),
  email: optionalEmail,
  url: optionalUrl,
  hours: openingHoursSchema,
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
