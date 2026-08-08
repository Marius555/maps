import type { MapCategory } from "@/lib/repositories/types";
import { CATEGORY_COLORS, MAX_CATEGORIES } from "@/lib/validation/category.schema";

export type ResolvedCategories = {
  /** The map's full category list after the import: existing plus new. */
  categories: MapCategory[];
  /** Newly created ones, so the review step can say what it is about to add. */
  added: MapCategory[];
  /** Normalised label → category id, for stamping onto each draft. */
  idByLabel: Map<string, string>;
  /** Labels dropped because the map is already at MAX_CATEGORIES. */
  dropped: string[];
};

/**
 * Turns the category text in a CSV into real categories.
 *
 * Places store a category *id*, not its label, so renaming a category later
 * doesn't orphan every location tagged with it. A CSV only has labels, so the
 * import has to reconcile them: match an existing category case-insensitively, or
 * create one and give it the next colour in the palette.
 */
export function resolveCategories(
  labels: string[],
  existing: MapCategory[],
): ResolvedCategories {
  const idByLabel = new Map<string, string>();
  for (const category of existing) {
    idByLabel.set(normalizeLabel(category.label), category.id);
  }

  const categories = [...existing];
  const added: MapCategory[] = [];
  const dropped: string[] = [];

  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) continue;

    const key = normalizeLabel(trimmed);
    if (idByLabel.has(key)) continue;

    if (categories.length >= MAX_CATEGORIES) {
      // Reported rather than silently ignored — the user decides whether to
      // proceed with these rows uncategorised.
      if (!dropped.includes(trimmed)) dropped.push(trimmed);
      continue;
    }

    const category: MapCategory = {
      id: categoryId(trimmed, idByLabel),
      label: trimmed.slice(0, 64),
      // Cycled by position, so an import of eight categories gets eight
      // distinguishable colours instead of eight identical ones.
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
    };

    categories.push(category);
    added.push(category);
    idByLabel.set(key, category.id);
  }

  return { categories, added, idByLabel, dropped };
}

export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * A readable, stable id derived from the label, with a numeric suffix if that
 * slug is taken. Readable ids make the stored JSON debuggable by eye.
 */
function categoryId(label: string, taken: Map<string, string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "category";

  const usedIds = new Set(taken.values());
  if (!usedIds.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!usedIds.has(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}
