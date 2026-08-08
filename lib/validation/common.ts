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
 * Appwrite caps a page at 100 rows, so anything larger would be silently
 * truncated. Reject it here instead.
 */
export const paginationSchema = z.object({
  cursor: z.string().max(36).nullish(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
