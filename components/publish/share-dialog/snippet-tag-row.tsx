"use client";

import { useId } from "react";

import { TagToggleChip } from "@/components/tags/tag-chip";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import { tagGroupsInUse, wornTagIds } from "@/lib/tags/tag-usage";

/**
 * Narrowing one pasted copy of the map to some of its tags, as one compact row.
 *
 * The same map on a "Stockists" page and an "Outlets" page, from one snippet
 * each — the choice lives in the snippet (`data-tags`), not the map, so it
 * costs no republish and the two pages cannot fight over one setting. Nothing
 * chosen is the whole map, which is what every snippet pasted before this
 * still shows.
 *
 * **It explains itself with a count, not a paragraph** (2026-11-07: the
 * dialog had too much text). "Show" and "40 locations" say what the chips do;
 * pressing one turns the count into "12 of 40", which says the rest. The group
 * name is drawn only when there is more than one group, because with one it
 * repeats the row's own label.
 *
 * **Only tags somebody wears are offered.** The embed's `onlyTagged` falls back
 * to the whole map when nothing matches — right for a pasted snippet whose tag
 * was later deleted, but a chip for a tag nobody wears then looks like a choice
 * that does nothing. `tagGroupsInUse` is the rule the snapshot publishes with.
 * Selected ids are kept too, so a chip already on can still be switched off.
 */
export function SnippetTagRow({
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
  const labelId = useId();
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

  const showGroupNames = usable.length > 1;

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="text-sm font-medium text-foreground">
          Show
        </p>
        <p className="text-xs text-muted" aria-live="polite">
          {shownLabel(places, selected)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {usable.map((group) => (
          <div key={group.id} className="contents">
            {showGroupNames ? (
              <span className="text-xs text-muted">{group.label || "Untitled group"}</span>
            ) : null}
            {group.tags.map((tag) => (
              <TagToggleChip
                key={tag.id}
                label={tag.label || "Unnamed tag"}
                isOn={selected.has(tag.id)}
                onToggle={() => toggle(tag.id)}
              />
            ))}
          </div>
        ))}
      </div>
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

  if (selected.size === 0) return `All ${total} ${noun}`;

  const shown = places.filter((place) =>
    place.tags.some((id) => selected.has(id)),
  ).length;

  return `${shown} of ${total} ${noun}`;
}
