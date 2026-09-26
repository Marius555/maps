"use client";

import { Button } from "@heroui/react";
import { Filter, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import { MAX_TAG_GROUPS, newTagGroupId } from "@/lib/validation/tag.schema";
import { TagGroupRow } from "./tag-group-row";

/**
 * The map's filter vocabulary, edited as a draft.
 *
 * The draft and its save belong to the Tags & fields dialog, which saves this
 * and the extra fields with one button (VocabularyDialog). This used to carry
 * its own Save and an inline "Saved" chip, one per tab, and neither said what
 * had been saved or where.
 *
 * This is the map's **only** vocabulary. It used to sit next to a Categories
 * panel asking the same question under another name — one category per location
 * because it coloured the pin, any number of colourless tags for everything else
 * — and an owner meeting both had no way to tell which one to reach for.
 * Categories merged in: a tag carries a colour, a location wears as many as
 * apply, and the first one it was given is what colours its pin.
 */
export function TagGroupEditor({
  draft,
  places,
  onChange,
}: {
  draft: MapTagGroup[];
  places: Place[];
  onChange: (next: MapTagGroup[]) => void;
}) {
  const usageByTag = useMemo(() => {
    const counts = new Map<string, number>();
    for (const place of places) {
      for (const id of place.tags) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [places]);

  /*
   * Across every group, not per group: a pin shows a colour and a visitor reads
   * one legend, so two tags matching across two questions is the collision worth
   * avoiding. Read off the draft rather than the map so two tags added before a
   * save do not come out the same.
   */
  const takenColors = draft.flatMap((group) => group.tags.map((tag) => tag.color));

  // The group just added takes focus, so "Add group" then typing names it.
  const [addedId, setAddedId] = useState<string | null>(null);

  const atLimit = draft.length >= MAX_TAG_GROUPS;

  const addGroup = () => {
    const id = newTagGroupId();
    setAddedId(id);
    onChange([...draft, { id, label: "", tags: [] }]);
  };

  const addButton = (
    <Button size="sm" variant="secondary" isDisabled={atLimit} onPress={addGroup}>
      <Plus aria-hidden="true" className="size-4" />
      Add group
    </Button>
  );

  if (draft.length === 0) {
    /*
     * The button, not just the sentence telling you to press one: an empty
     * state is an invitation to act and the action belongs in it (§8).
     */
    return (
      <EmptyState
        size="sm"
        icon={Filter}
        title="No filters yet"
        description="A group is one question — “Sells”, or “Open on Sundays”. The tags inside it are the answers a visitor picks from."
        action={addButton}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-pretty text-sm text-muted">
        Visitors use tags to narrow the map. Tags in one group widen the results;
        tags in different groups narrow them. A location&rsquo;s first tag colours
        its pin.
      </p>

      <ul className="space-y-3">
        {draft.map((group, index) => (
          <TagGroupRow
            key={group.id}
            group={group}
            autoFocus={group.id === addedId}
            usageByTag={usageByTag}
            takenColors={takenColors}
            onChange={(next) =>
              onChange(
                draft.map((existing, position) => (position === index ? next : existing)),
              )
            }
            onRemove={() => onChange(draft.filter((_, position) => position !== index))}
          />
        ))}
      </ul>

      {addButton}

      {/*
        Removing a tag does not untag the locations wearing it — nothing sweeps
        those up, deliberately (lib/repositories/maps.repository.ts). Publishing
        drops them, so the map a visitor sees is correct either way, but the
        owner should know the data is still there if they put the tag back.
      */}
      <p className="text-xs text-muted">
        {atLimit
          ? `You’ve reached the maximum of ${MAX_TAG_GROUPS} filter groups. `
          : null}
        Removing a tag hides it from your published map. Locations keep it until you
        change them.
      </p>
    </div>
  );
}
