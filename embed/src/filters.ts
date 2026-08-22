import type {
  SnapshotCategory,
  SnapshotTagGroup,
} from "@/packages/shared/snapshot";

import { matchesTags, tagGroupIndex } from "@/packages/shared/tags";

import { button, el } from "./dom";

/**
 * The matching itself lives in /packages/shared, not here.
 *
 * Re-exported so the rest of the embed still imports its filtering from one
 * place, the way ./geo.ts re-exports the distance maths — see that file and
 * packages/shared/tags.ts for why the rule cannot live in only one target.
 */
export { matchesTags, tagGroupIndex };

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

/**
 * The tag chips, one labelled row per group.
 *
 * Separate from the category chips above rather than merged into them, because
 * they answer different questions and combine differently: categories are one
 * flat OR, and tags are OR within a group and AND across groups. Rendering them
 * as one undifferentiated row of chips would make that impossible to see, and a
 * visitor who cannot see it reads a narrowing filter as a broken one.
 *
 * Selection is a single flat set of tag ids for every group. Tag ids are unique
 * across the whole map (lib/validation/tag.schema.ts), so which group a chip
 * belongs to is a lookup rather than something the caller has to track.
 */
export function createTagFilters(
  groups: SnapshotTagGroup[],
  onChange: (selected: Set<string>) => void,
): HTMLElement | null {
  if (groups.length === 0) return null;

  const selected = new Set<string>();
  const root = el("div", "lm-filter-groups");

  for (const group of groups) {
    if (group.tags.length === 0) continue;

    const section = el("div", "lm-filter-group");
    section.setAttribute("role", "group");
    // The heading is the accessible name of the set, so a screen reader hears
    // "Sells, group" rather than eleven unrelated toggles in a row.
    section.setAttribute("aria-label", group.label);
    section.append(el("p", "lm-filter-group__label", group.label));

    const chips = el("div", "lm-filters");

    for (const tag of group.tags) {
      // No colour dot: a tag has no colour, and borrowing the category chip's
      // would invent a legend that means nothing.
      const chip = button("lm-chip lm-chip--plain", tag.label);
      chip.setAttribute("aria-pressed", "false");

      chip.addEventListener("click", () => {
        const isOn = selected.has(tag.id);

        if (isOn) selected.delete(tag.id);
        else selected.add(tag.id);

        chip.setAttribute("aria-pressed", String(!isOn));
        chip.classList.toggle("lm-chip--on", !isOn);

        onChange(new Set(selected));
      });

      chips.append(chip);
    }

    section.append(chips);
    root.append(section);
  }

  return root.childElementCount > 0 ? root : null;
}
