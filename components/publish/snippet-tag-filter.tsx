"use client";

import { TagToggleChip } from "@/components/tags/tag-chip";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import { tagGroupsInUse, wornTagIds } from "@/lib/tags/tag-usage";

/**
 * Narrowing one pasted copy of the map to some of its tags.
 *
 * The same map on a "Stockists" page and an "Outlets" page, from one snippet
 * each — the choice lives in the snippet (`data-tags`), not the map, so it costs
 * no republish and the two pages cannot fight over one setting. Nothing chosen
 * is the whole map, which is what every snippet pasted before this still shows.
 *
 * The same chip the locations filter uses, grouped under the same headings,
 * because it is the same question asked about the same vocabulary.
 *
 * **Only tags somebody wears are offered.** The embed's `onlyTagged` falls back
 * to the whole map when nothing matches — right for a pasted snippet whose tag
 * was later deleted, but a chip for a tag nobody wears then looks like a choice
 * that does nothing. `tagGroupsInUse` is the rule the snapshot publishes with.
 * Selected ids are kept too, so a chip already on can still be switched off.
 */
export function SnippetTagFilter({
  groups,
  places,
  selected,
  onChange,
}: {
  groups: MapTagGroup[];
  places: Place[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const keep = wornTagIds(places);
  for (const id of selected) keep.add(id);

  const usable = tagGroupsInUse(groups, keep);
  if (usable.length === 0) return null;

  const toggle = (id: string) => {
    const next = new Set(selected);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-pretty text-xs text-muted">
        Show only locations with these tags on this page. Leave them all off to
        show the whole map.
      </p>

      {usable.map((group) => (
        <fieldset key={group.id} className="space-y-1.5">
          <legend className="text-xs font-medium text-muted">
            {group.label || "Untitled group"}
          </legend>

          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <TagToggleChip
                key={tag.id}
                label={tag.label || "Unnamed tag"}
                isOn={selected.has(tag.id)}
                onToggle={() => toggle(tag.id)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <p className="text-xs text-muted" aria-live="polite">
        {shownLabel(places, selected)}
      </p>
    </div>
  );
}

/**
 * The same any-of rule as the embed's `onlyTagged`, so the number here is the
 * number of pins the pasted snippet draws.
 */
function shownLabel(places: Place[], selected: ReadonlySet<string>): string {
  const total = places.length;
  const noun = total === 1 ? "location" : "locations";

  if (selected.size === 0) return `Shows all ${total} ${noun}.`;

  const shown = places.filter((place) =>
    place.tags.some((id) => selected.has(id)),
  ).length;

  return `Shows ${shown} of ${total} ${noun}.`;
}
