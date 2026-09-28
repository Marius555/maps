"use client";

import { Button } from "@heroui/react";
import { Plus, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { IMPORTED_TAG_GROUP_LABEL } from "@/lib/import/resolve-tags";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { nextPaletteColor } from "@/lib/validation/palette";
import {
  MAX_TAG_GROUPS,
  MAX_TAGS_PER_GROUP,
  MAX_TAGS_TOTAL,
  newTagGroupId,
  newTagId,
} from "@/lib/validation/tag.schema";
import { TagRow } from "./tag-row";

type MapTag = MapTagGroup["tags"][number];

/**
 * The map's tags, as one flat list, edited as a draft.
 *
 * **Groups are still in the data and no longer on screen.** A group only ever
 * decided the filter logic — tags in one group widen a visitor's results, tags
 * in different groups narrow them (packages/shared/tags.ts) — and owners read
 * "Group name" as a second way to group locations, beside the tags that already
 * do that. So every tag of every group is listed here as one list, each edit is
 * written back into the group the tag lives in, and a map that has several
 * groups keeps filtering exactly as it did. A new tag joins the first group with
 * room, or a new one named like an imported column's (`IMPORTED_TAG_GROUP_LABEL`),
 * the same place `tag-quick-add.tsx` puts one.
 *
 * The draft and its save belong to the Tags & fields dialog, which saves this
 * and the extra fields with one button (VocabularyDialog).
 */
export function TagListEditor({
  draft,
  places,
  pinIcons,
  onChange,
  onEditPlace,
}: {
  draft: MapTagGroup[];
  places: Place[];
  pinIcons: CustomPinIcon[];
  onChange: (next: MapTagGroup[]) => void;
  /** Opens a location in Edit location, over this dialog. */
  onEditPlace: (placeId: string) => void;
}) {
  const wornBy = useMemo(() => {
    const byTag = new Map<string, Place[]>();
    for (const place of places) {
      for (const id of place.tags) {
        const list = byTag.get(id);
        if (list) list.push(place);
        else byTag.set(id, [place]);
      }
    }
    return byTag;
  }, [places]);

  // The tag just added takes focus, so "Add tag" then typing names it.
  const [addedId, setAddedId] = useState<string | null>(null);

  const rows = draft.flatMap((group) =>
    group.tags.map((tag) => ({ groupId: group.id, tag })),
  );

  const target = draft.find((group) => group.tags.length < MAX_TAGS_PER_GROUP);
  const canAdd =
    rows.length < MAX_TAGS_TOTAL && (target !== undefined || draft.length < MAX_TAG_GROUPS);

  const updateTag = (groupId: string, tagId: string, patch: Partial<MapTag>) =>
    onChange(
      draft.map((group) =>
        group.id === groupId
          ? {
              ...group,
              tags: group.tags.map((tag) =>
                tag.id === tagId ? { ...tag, ...patch } : tag,
              ),
            }
          : group,
      ),
    );

  const removeTag = (groupId: string, tagId: string) =>
    onChange(
      draft.map((group) =>
        group.id === groupId
          ? { ...group, tags: group.tags.filter((tag) => tag.id !== tagId) }
          : group,
      ),
    );

  const addTag = () => {
    // Fresh id, never a reused one — see newTagId. The colour avoids every
    // colour the map already wears: a pin shows one, and a visitor reads one
    // legend.
    const tag: MapTag = {
      id: newTagId(),
      label: "",
      color: nextPaletteColor(rows.map((row) => row.tag.color)),
    };
    setAddedId(tag.id);

    if (target) {
      onChange(
        draft.map((group) =>
          group.id === target.id ? { ...group, tags: [...group.tags, tag] } : group,
        ),
      );
      return;
    }

    onChange([
      ...draft,
      { id: newTagGroupId(), label: freshGroupLabel(draft), tags: [tag] },
    ]);
  };

  const addButton = (
    <Button size="sm" variant="secondary" isDisabled={!canAdd} onPress={addTag}>
      <Plus aria-hidden="true" className="size-4" />
      Add tag
    </Button>
  );

  if (rows.length === 0) {
    // The button, not just a sentence telling you to press one (§8).
    return (
      <EmptyState
        size="sm"
        icon={Tags}
        title="No tags yet"
        description="Tags are what visitors filter your map by — “Bikes”, “Open Sundays”. A location’s first tag colours its pin."
        action={addButton}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-pretty text-sm text-muted">
        Visitors use tags to narrow the map. A location&rsquo;s first tag colours
        its pin.
      </p>

      <ul className="space-y-2">
        {rows.map(({ groupId, tag }) => (
          <TagRow
            key={tag.id}
            tag={tag}
            autoFocus={tag.id === addedId}
            wornBy={wornBy.get(tag.id) ?? []}
            tagGroups={draft}
            pinIcons={pinIcons}
            onChange={(patch) => updateTag(groupId, tag.id, patch)}
            onRemove={() => removeTag(groupId, tag.id)}
            onEditPlace={onEditPlace}
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
        {canAdd ? null : `You’ve reached the maximum of ${MAX_TAGS_TOTAL} tags. `}
        Removing a tag hides it from your published map. Locations keep it until you
        change them.
      </p>
    </div>
  );
}

/**
 * A name for a group nobody sees, unique because the schema refuses two groups
 * with one name. "Tags", then "Tags 2", "Tags 3".
 */
function freshGroupLabel(groups: readonly MapTagGroup[]): string {
  const taken = new Set(groups.map((group) => group.label.toLowerCase()));
  if (!taken.has(IMPORTED_TAG_GROUP_LABEL.toLowerCase())) return IMPORTED_TAG_GROUP_LABEL;

  for (let n = 2; ; n += 1) {
    const label = `${IMPORTED_TAG_GROUP_LABEL} ${n}`;
    if (!taken.has(label.toLowerCase())) return label;
  }
}
