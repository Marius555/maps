"use client";

import { Button, Chip } from "@heroui/react";
import { Filter, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap, MapTagGroup, Place } from "@/lib/repositories/types";
import {
  MAX_TAG_GROUPS,
  newTagGroupId,
  tagGroupsSchema,
} from "@/lib/validation/tag.schema";
import { TagGroupRow } from "./tag-group-row";

/**
 * The map's filter vocabulary, edited as a list and saved in one go.
 *
 * Edited as a draft and saved in one go, because the whole thing is one JSON
 * column: there is nothing finer to save, and saving per keystroke would mean a
 * PATCH for every letter of a rename.
 *
 * This is the map's **only** vocabulary now. It used to sit next to a Categories
 * panel asking the same question under another name — one category per location
 * because it coloured the pin, any number of colourless tags for everything else
 * — and an owner meeting both on one settings page had no way to tell which one
 * to reach for. Categories merged in: a tag carries a colour, a location wears
 * as many as apply, and the first one it was given is what colours its pin.
 */
export function TagGroupEditor({ map, places }: { map: AppMap; places: Place[] }) {
  const updateMap = useUpdateMap(map.id);
  const [draft, setDraft] = useState<MapTagGroup[]>(map.tagGroups);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
  const takenColors = draft.flatMap((group) =>
    group.tags.map((tag) => tag.color),
  );

  const isDirty = JSON.stringify(draft) !== JSON.stringify(map.tagGroups);

  const addGroup = () => {
    setDraft((current) => [
      ...current,
      { id: newTagGroupId(), label: "", tags: [] },
    ]);
  };

  const save = async () => {
    setProblem(null);
    setSavedAt(null);

    const parsed = tagGroupsSchema.safeParse(draft);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the filters and try again.");
      return;
    }

    try {
      await updateMap.mutateAsync({ tagGroups: parsed.data });
      setDraft(parsed.data);
      setSavedAt(Date.now());
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SectionPanel
      title="Filters"
      description="Tags let visitors narrow the map by what a location offers. Tags in the same group widen the results; tags in different groups narrow them."
      action={
        <Button
          size="sm"
          variant="secondary"
          isDisabled={draft.length >= MAX_TAG_GROUPS}
          onPress={addGroup}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add group
        </Button>
      }
      footer={
        <>
          {savedAt && !isDirty ? (
            <Chip size="sm" variant="soft" color="success" role="status">
              Saved
            </Chip>
          ) : null}
          <Button isDisabled={!isDirty} isPending={updateMap.isPending} onPress={save}>
            Save filters
          </Button>
        </>
      }
    >
      {problem ? <ErrorMessage error={problem} /> : null}
      {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

      {draft.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Filter}
          title="No filters yet"
          description="Add a group — like “Sells” or “Services” — and the tags a visitor can pick from."
        />
      ) : (
        <ul className="space-y-3">
          {draft.map((group, index) => (
            <TagGroupRow
              key={group.id}
              group={group}
              usageByTag={usageByTag}
              takenColors={takenColors}
              onChange={(next) =>
                setDraft((current) =>
                  current.map((existing, position) =>
                    position === index ? next : existing,
                  ),
                )
              }
              onRemove={() =>
                setDraft((current) =>
                  current.filter((_, position) => position !== index),
                )
              }
            />
          ))}
        </ul>
      )}

      {/*
        Removing a tag does not untag the locations wearing it — nothing sweeps
        those up, deliberately (lib/repositories/maps.repository.ts). Publishing
        drops them, so the map a visitor sees is correct either way, but the
        owner should know the data is still there if they put the tag back.
      */}
      {draft.length > 0 ? (
        <p className="text-xs text-muted">
          Removing a tag hides it from your published map. Locations keep it until
          you change them.
        </p>
      ) : null}

      {draft.length >= MAX_TAG_GROUPS ? (
        <p className="text-xs text-muted">
          You&rsquo;ve reached the maximum of {MAX_TAG_GROUPS} filter groups.
        </p>
      ) : null}
    </SectionPanel>
  );
}
