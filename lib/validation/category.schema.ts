import { z } from "zod";

import { hexColorSchema } from "./common";

/** Enough for a legend a visitor can actually scan. */
export const MAX_CATEGORIES = 24;

export const categorySchema = z.object({
  /** Stable across renames — places reference this, not the label. */
  id: z.string().trim().min(1).max(36),
  label: z
    .string()
    .trim()
    .min(1, "Give the category a name.")
    .max(64, "Keep the name under 64 characters."),
  color: hexColorSchema,
});

export const categoriesSchema = z
  .array(categorySchema)
  .max(MAX_CATEGORIES, `You can have up to ${MAX_CATEGORIES} categories.`)
  .refine(
    (categories) => new Set(categories.map((c) => c.id)).size === categories.length,
    "Two categories share an id.",
  )
  .refine(
    (categories) =>
      new Set(categories.map((c) => c.label.toLowerCase())).size ===
      categories.length,
    "Two categories have the same name. Give each one a distinct name.",
  );

export type CategoryInput = z.infer<typeof categorySchema>;
