import { z } from "zod";

/** One step of the unconfirmed-account purge: the last account the previous step kept. */
export const unconfirmedPurgeStepSchema = z.object({
  cursor: z.string().trim().min(1).max(36).nullable().default(null),
});
