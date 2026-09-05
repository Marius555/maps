"use client";

import { useState } from "react";

import { TagPicker } from "@/components/tags/tag-picker";
import { useUpdatePlace } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { SlotShell } from "./slot-shell";

/**
 * Tags, through the one control that asks that question.
 *
 * `TagPicker` and nothing else, for the reason it was built: a map whose owner
 * has never opened Settings has no tags at all, and its dropdown opens with
 * **+ New tag** above the vocabulary — so this slot works on the very first
 * location of a brand-new map, which is exactly when someone clicks a pin and
 * finds an empty Tags block. A cut-down picker here would be the second control
 * asking one question that the dialog was already fixed for.
 *
 * The order the chips are in is the order that is saved, untouched: the first
 * tag colours the pin, and the picker owns the gesture that says which one that
 * is (`use-chip-reorder.ts`). Nothing between it and the PATCH may sort them.
 *
 * `map` rather than `mapId`, because the quick-add writes the map's whole
 * `tagGroups` — see `TagQuickAdd`. It is the reason the whole `AppMap` has to
 * reach the canvas at all; see `cardSlots` in map-canvas-impl.tsx.
 */
export function SlotTagsForm({
  map,
  place,
  title,
  onDone,
}: {
  map: AppMap;
  place: Place;
  title: string;
  onDone: () => void;
}) {
  const updatePlace = useUpdatePlace(map.id);
  const [tags, setTags] = useState<string[]>(place.tags);

  const submit = async () => {
    try {
      await updatePlace.mutateAsync({ placeId: place.id, input: { tags } });
      onDone();
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SlotShell
      title={title}
      error={updatePlace.error}
      isPending={updatePlace.isPending}
      isDisabled={tags.length === 0}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <TagPicker map={map} value={tags} onChange={setTags} />
    </SlotShell>
  );
}
