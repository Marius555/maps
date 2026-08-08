import { z } from "zod";

/**
 * Categories are user data, so they are stored as plain hex — not as theme
 * variables. They travel into the published snapshot and get read by the embed
 * on someone else's site, where our CSS variables don't exist.
 */

/** Offered as swatches. Any valid hex is still accepted. */
export const CATEGORY_COLORS = [
  "#e8590c",
  "#d6336c",
  "#7048e8",
  "#1c7ed6",
  "#0ca678",
  "#66a80f",
  "#f08c00",
  "#495057",
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];

/** Enough for a legend a visitor can actually scan. */
export const MAX_CATEGORIES = 24;

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour, or enter a hex value like #e8590c.")
  // Stored lowercase so two spellings of one colour compare equal.
  .transform((value) => value.toLowerCase());

export const categorySchema = z.object({
  /** Stable across renames — places reference this, not the label. */
  id: z.string().trim().min(1).max(36),
  label: z
    .string()
    .trim()
    .min(1, "Give the category a name.")
    .max(64, "Keep the name under 64 characters."),
  color: hexColor,
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
