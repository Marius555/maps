import { z } from "zod";

import { hexColorSchema } from "./common";

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

/**
 * A name per swatch.
 *
 * React Aria's ColorSwatchPicker derives one from the value itself, so the
 * category picker needs nothing here. The pin studio renders its palette as
 * plain buttons — the swatch there has to sit centred in a carousel slot, which
 * that component's fixed-size items cannot do — and a control picked by eye
 * still owes a screen reader something to say.
 */
export const CATEGORY_COLOR_NAMES: Record<(typeof CATEGORY_COLORS)[number], string> = {
  "#e8590c": "Orange",
  "#d6336c": "Pink",
  "#7048e8": "Violet",
  "#1c7ed6": "Blue",
  "#0ca678": "Teal",
  "#66a80f": "Lime",
  "#f08c00": "Amber",
  "#495057": "Slate",
};

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];

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
