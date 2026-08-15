import { z } from "zod";

export const latSchema = z
  .number()
  .min(-90, "Latitude must be between -90 and 90.")
  .max(90, "Latitude must be between -90 and 90.");

export const lngSchema = z
  .number()
  .min(-180, "Longitude must be between -180 and 180.")
  .max(180, "Longitude must be between -180 and 180.");

export const zoomSchema = z
  .number()
  .min(0, "Zoom must be between 0 and 24.")
  .max(24, "Zoom must be between 0 and 24.");

export const idSchema = z.string().trim().min(1).max(36);

/**
 * Plain hex, shared by categories and custom pins.
 *
 * Both are user data that travels into the published snapshot and gets read by
 * the embed on someone else's site, where our CSS variables do not exist — so
 * neither may be stored as a theme token.
 */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour, or enter a hex value like #e8590c.")
  // Stored lowercase so two spellings of one colour compare equal.
  .transform((value) => value.toLowerCase());

/**
 * Appwrite caps a page at 100 rows, so anything larger would be silently
 * truncated. Reject it here instead.
 */
export const paginationSchema = z.object({
  cursor: z.string().max(36).nullish(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
