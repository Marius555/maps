import { z } from "zod";

import { IMPORT_FIELDS, type ImportField } from "@/lib/import/fields";
import { googleSheetSourceSchema } from "./import-source.schema";

/**
 * A column mapping as the import's mapping step leaves it: field → header.
 *
 * Headers are the sheet's own text, so the only bound is length. The name field
 * is required because without it a sync has nothing to label a location with —
 * the same refusal the mapping step itself makes.
 */
const columnMappingSchema = z
  .record(z.string(), z.string().trim().min(1).max(255))
  .refine(
    (mapping) =>
      Object.keys(mapping).every((key) =>
        (IMPORT_FIELDS as readonly string[]).includes(key),
      ),
    "That column mapping names a field we don't have.",
  )
  .refine((mapping) => Boolean(mapping.name), "Map a column to Name first.")
  .transform((mapping) => mapping as Partial<Record<ImportField, string>>);

/** What the import sends to link a map to the sheet it just read. */
export const saveSheetLinkSchema = googleSheetSourceSchema.extend({
  mapping: columnMappingSchema,
  headerRowIndex: z.number().int().min(0).max(10_000).nullable(),
  autoSync: z.boolean().default(true),
});

export type SaveSheetLinkInput = z.infer<typeof saveSheetLinkSchema>;

export const updateSheetLinkSchema = z.object({ autoSync: z.boolean() });

export const syncSheetSchema = z.object({
  /** Set only after the owner has seen how many locations will go. */
  confirmRemovals: z.boolean().default(false),
  /** This step follows one that answered `more: true`, in the same sync. */
  continuing: z.boolean().default(false),
});

/** The daily job's step request. It never confirms removals. */
export const cronSyncStepSchema = z.object({
  mapId: z.string().trim().min(1).max(36),
  continuing: z.boolean().default(false),
});
