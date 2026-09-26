"use client";

import { TagToggleChip } from "@/components/tags/tag-chip";
import type { MapTagGroup } from "@/lib/repositories/types";

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
 */
export function SnippetTagFilter({
  groups,
  selected,
  onChange,
}: {
  groups: MapTagGroup[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const usable = groups.filter((group) => group.tags.length > 0);
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
    </div>
  );
}
