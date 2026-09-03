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
 * There were category chips here once, and they are gone twice over.
 *
 * They were a row of toggles that doubled as the colour legend, and they cost a
 * line of a panel that is now a proportion of the embed rather than a fixed
 * 320px. Their question — "show me the retail ones" — is answered by typing the
 * word instead, because tag labels are part of the search index
 * (@/packages/shared/search-text.ts), so the word a visitor reads off a pin's
 * own card is the word that filters the map. Categories then merged into tags
 * outright, so there is no second vocabulary left to draw either way.
 *
 * The legend is not lost: every card and every list row carries the label of the
 * tag its pin is coloured by, with the colour beside it.
 */

/**
 * The tag chips, one labelled row per group.
 *
 * Grouped rather than one undifferentiated row, because the groups are how the
 * matching works: OR within a group, AND across groups. A flat row would make
 * that impossible to see, and a visitor who cannot see it reads a narrowing
 * filter as a broken one.
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
