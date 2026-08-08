"use client";

import { Button, Chip } from "@heroui/react";
import { Plus, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap, MapCategory, Place } from "@/lib/repositories/types";
import {
  CATEGORY_COLORS,
  MAX_CATEGORIES,
  categoriesSchema,
} from "@/lib/validation/category.schema";
import { CategoryRow } from "./category-row";

/**
 * Categories are edited as a list and saved in one go.
 *
 * Saving per-keystroke would mean a PATCH for every letter of a rename, and the
 * whole array is one JSON column anyway — there is nothing finer to save.
 */
export function CategoryEditor({
  map,
  places,
}: {
  map: AppMap;
  places: Place[];
}) {
  const updateMap = useUpdateMap(map.id);
  const [draft, setDraft] = useState<MapCategory[]>(map.categories);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const usageByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const place of places) {
      if (!place.category) continue;
      counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
    }
    return counts;
  }, [places]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(map.categories);

  const addCategory = () => {
    setDraft((current) => [
      ...current,
      {
        id: `cat-${crypto.randomUUID().slice(0, 8)}`,
        label: "",
        // Next unused colour, so a new row never arrives looking identical to
        // the one above it.
        color: CATEGORY_COLORS[current.length % CATEGORY_COLORS.length],
      },
    ]);
  };

  const save = async () => {
    setProblem(null);
    setSavedAt(null);

    const parsed = categoriesSchema.safeParse(draft);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the categories and try again.");
      return;
    }

    try {
      await updateMap.mutateAsync({ categories: parsed.data });
      setDraft(parsed.data);
      setSavedAt(Date.now());
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SectionPanel
      title="Categories"
      description="Group your locations so visitors can filter the map. Each one gets a colour on the map and in the legend."
      action={
        <Button
          size="sm"
          variant="secondary"
          isDisabled={draft.length >= MAX_CATEGORIES}
          onPress={addCategory}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add
        </Button>
      }
      footer={
        <>
          {savedAt && !isDirty ? (
            <Chip size="sm" variant="soft" color="success" role="status">
              Saved
            </Chip>
          ) : null}
          <Button
            isDisabled={!isDirty}
            isPending={updateMap.isPending}
            onPress={save}
          >
            Save categories
          </Button>
        </>
      }
    >
      {problem ? <ErrorMessage error={problem} /> : null}
      {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

      {draft.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Tags}
          title="No categories yet"
          description="Add one to let visitors filter your map."
        />
      ) : (
        <ul className="space-y-2">
          {draft.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              usageCount={usageByCategory.get(category.id) ?? 0}
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

      {draft.length >= MAX_CATEGORIES ? (
        <p className="text-xs text-muted">
          You&rsquo;ve reached the maximum of {MAX_CATEGORIES} categories.
        </p>
      ) : null}
    </SectionPanel>
  );
}
