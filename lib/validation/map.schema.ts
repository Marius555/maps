import { z } from "zod";

import { DEFAULT_CENTER } from "@/lib/config";
import { DEFAULT_MAP_STYLE, MAP_STYLES } from "@/lib/map/style";
import { categoriesSchema } from "./category.schema";
import { latSchema, lngSchema, zoomSchema } from "./common";
import { allowedDomainsSchema } from "./domain.schema";
import { embedSettingsSchema } from "./embed-settings.schema";
import { pinIconsSchema } from "./pin-icon.schema";

export const createMapSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the map a name.")
    .max(128, "Keep the name under 128 characters."),
  style: z.enum(MAP_STYLES).default(DEFAULT_MAP_STYLE),
  defaultLat: latSchema.default(DEFAULT_CENTER.lat),
  defaultLng: lngSchema.default(DEFAULT_CENTER.lng),
  defaultZoom: zoomSchema.default(DEFAULT_CENTER.zoom),
});

export const updateMapSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give the map a name.")
      .max(128, "Keep the name under 128 characters."),
    style: z.enum(MAP_STYLES),
    defaultLat: latSchema,
    defaultLng: lngSchema,
    defaultZoom: zoomSchema,
    categories: categoriesSchema,
    pinIcons: pinIconsSchema,
    settings: embedSettingsSchema,
    allowedDomains: allowedDomainsSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to save.");

/**
 * `.default()` makes the parsed output wider than the accepted input, so forms
 * and handlers need different sides of the schema:
 * - CreateMapFormValues is what react-hook-form holds (defaults may be absent).
 * - CreateMapInput is what comes out of a successful parse.
 */
export type CreateMapFormValues = z.input<typeof createMapSchema>;
export type CreateMapInput = z.output<typeof createMapSchema>;
export type UpdateMapInput = z.output<typeof updateMapSchema>;
