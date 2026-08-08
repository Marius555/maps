import type { SnapshotCategory } from "@/packages/shared/snapshot";

import { button, el } from "./dom";

/**
 * Category filter chips.
 *
 * Toggles rather than a dropdown: with a handful of categories the whole set is
 * visible at a glance, and each chip carries its own colour so the legend and
 * the filter are the same control instead of two things to reconcile.
 */
export function createFilters(
  categories: SnapshotCategory[],
  onChange: (selected: Set<string>) => void,
): HTMLElement | null {
  if (categories.length === 0) return null;

  const selected = new Set<string>();
  const root = el("div", "lm-filters");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Filter by category");

  for (const category of categories) {
    const chip = button("lm-chip", category.label);
    chip.style.setProperty("--lm-category-color", category.color);
    // Toggle state belongs on the element, so assistive tech hears it change.
    chip.setAttribute("aria-pressed", "false");

    chip.addEventListener("click", () => {
      const isOn = selected.has(category.id);

      if (isOn) selected.delete(category.id);
      else selected.add(category.id);

      chip.setAttribute("aria-pressed", String(!isOn));
      chip.classList.toggle("lm-chip--on", !isOn);

      onChange(new Set(selected));
    });

    root.append(chip);
  }

  return root;
}

/**
 * Nothing selected means everything is shown — an empty filter set is "no
 * filter", not "no results".
 */
export function matchesCategories(
  category: string | undefined,
  selected: Set<string>,
): boolean {
  return selected.size === 0 || selected.has(category ?? "");
}
