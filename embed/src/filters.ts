import type { SnapshotTagGroup } from "@/packages/shared/snapshot";

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

/*
 * There are no category chips here any more, and that is deliberate.
 *
 * They were a row of toggles that doubled as the colour legend, and they cost a
 * line of a panel that is now a proportion of the embed rather than a fixed
 * 320px. The question they answered — "show me the retail ones" — is answered by
 * typing the word instead: category labels are part of the search index
 * (@/packages/shared/search-text.ts), so the word a visitor reads off a pin's
 * own card is the word that filters the map. The legend is not lost either;
 * every card and every list row still carries the label with its colour dot.
 *
 * The tag chips below stay, because search cannot replace them: the embed reads
 * tags as AND across groups and OR within one, and a text box has no way to say
 * "sells bikes OR skis, AND opens on Sundays".
 */

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
      const chip = button("lm-chip", tag.label);
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
