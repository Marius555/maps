"use client";

import { useState } from "react";

import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap, MapField, MapTagGroup } from "@/lib/repositories/types";
import { customFieldsSchema } from "@/lib/validation/field.schema";
import { tagGroupsSchema } from "@/lib/validation/tag.schema";

export type VocabularyTab = "filters" | "fields";

type Patch = { tagGroups?: MapTagGroup[]; fields?: MapField[] };

/**
 * Both halves of the Tags & fields dialog as one draft, saved by one button.
 *
 * **Only the columns that changed are sent.** `tagGroups` has other writers —
 * the location form's quick-add (tag-quick-add.tsx) and the import wizard — so a
 * save that always sent both columns would put back whatever this dialog opened
 * with over a tag added since, just because somebody renamed a field.
 *
 * Validation runs per column before anything is sent, and a failure names the
 * tab it belongs to so the dialog can show it: an error about a blank group name
 * reported while the Extra fields tab is open is an error with nothing to fix
 * on screen.
 */
export function useVocabularyDraft(map: AppMap) {
  const updateMap = useUpdateMap(map.id);
  const [tagGroups, setTagGroups] = useState<MapTagGroup[]>(map.tagGroups);
  const [fields, setFields] = useState<MapField[]>(map.fields);
  const [problem, setProblem] = useState<{ tab: VocabularyTab; message: string } | null>(
    null,
  );

  const tagsDirty = JSON.stringify(tagGroups) !== JSON.stringify(map.tagGroups);
  const fieldsDirty = JSON.stringify(fields) !== JSON.stringify(map.fields);

  /**
   * Resolves `null` once saved, or with the tab whose validation failed — read
   * from the return value, because `problem` in the caller's closure is the
   * render before this ran. A failed request rejects.
   */
  const save = async (): Promise<VocabularyTab | null> => {
    setProblem(null);
    const patch: Patch = {};

    if (tagsDirty) {
      const parsed = tagGroupsSchema.safeParse(tagGroups);
      if (!parsed.success) {
        setProblem({
          tab: "filters",
          message: parsed.error.issues[0]?.message ?? "Check the filters and try again.",
        });
        return "filters";
      }
      patch.tagGroups = parsed.data;
    }

    if (fieldsDirty) {
      const parsed = customFieldsSchema.safeParse(fields);
      if (!parsed.success) {
        setProblem({
          tab: "fields",
          message: parsed.error.issues[0]?.message ?? "Check the fields and try again.",
        });
        return "fields";
      }
      patch.fields = parsed.data;
    }

    if (patch.tagGroups || patch.fields) await updateMap.mutateAsync(patch);
    return null;
  };

  return {
    tagGroups,
    setTagGroups,
    fields,
    setFields,
    problem,
    isDirty: tagsDirty || fieldsDirty,
    isSaving: updateMap.isPending,
    save,
  };
}
