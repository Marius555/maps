import { z } from "zod";

/** One step of the visitor-session purge: where the previous step stopped. */
export const sessionRetentionStepSchema = z.object({
  cursor: z.string().trim().min(1).max(36).nullable().default(null),
});
