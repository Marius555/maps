"use client";

import { Button, Chip } from "@heroui/react";
import { ListPlus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap, MapField, Place } from "@/lib/repositories/types";
import {
  DEFAULT_CUSTOM_FIELD_DISPLAY,
  DEFAULT_CUSTOM_FIELD_TYPE,
  MAX_CUSTOM_FIELDS,
  customFieldsSchema,
  newCustomFieldId,
} from "@/lib/validation/field.schema";
import { CustomFieldRow } from "./custom-field-row";

/**
 * Extra fields, defined once for the whole map and filled in per location.
 *
 * Same list-and-save-in-one-go shape as the category and filter panels beside
 * it, for the same reason: it is one JSON column.
 *
 * The order of this list is the order the popup renders, which is why rows can
 * be removed but the list is otherwise left in the order it was built — an owner
 * arranging their card is arranging this.
 */
export function CustomFieldEditor({ map, places }: { map: AppMap; places: Place[] }) {
  const updateMap = useUpdateMap(map.id);
  const [draft, setDraft] = useState<MapField[]>(map.fields);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const usageByField = useMemo(() => {
    const counts = new Map<string, number>();
    for (const place of places) {
      for (const [id, value] of Object.entries(place.fields)) {
        // An empty answer is not an answer — the same rule publishing applies.
        if (value) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [places]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(map.fields);

  const addField = () => {
    setDraft((current) => [
      ...current,
      {
        // Fresh id, never reused: a place's answers are keyed by this, so a
        // repeated id would hand a new field the old one's values.
        id: newCustomFieldId(),
        label: "",
        type: DEFAULT_CUSTOM_FIELD_TYPE,
        showAs: DEFAULT_CUSTOM_FIELD_DISPLAY,
      },
    ]);
  };

  const save = async () => {
    setProblem(null);
    setSavedAt(null);

    const parsed = customFieldsSchema.safeParse(draft);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
      return;
    }

    try {
      await updateMap.mutateAsync({ fields: parsed.data });
      setDraft(parsed.data);
      setSavedAt(Date.now());
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SectionPanel
      title="Extra fields"
      description="Anything your locations carry that the built-in fields don't cover — a booking link, a menu, a dealer code. They appear on the card a visitor opens."
      action={
        <Button
          size="sm"
          variant="secondary"
          isDisabled={draft.length >= MAX_CUSTOM_FIELDS}
          onPress={addField}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add field
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
            Save fields
          </Button>
        </>
      }
    >
      {problem ? <ErrorMessage error={problem} /> : null}
      {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

      {draft.length === 0 ? (
        <EmptyState
          size="sm"
          icon={ListPlus}
          title="No extra fields yet"
          description="Add one and every location gets somewhere to fill it in."
        />
      ) : (
        <ul className="space-y-2">
          {draft.map((field, index) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              usageCount={usageByField.get(field.id) ?? 0}
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

      {draft.length > 0 ? (
        <p className="text-xs text-muted">
          Fields appear on the card in this order. Removing one hides it from your
          published map; locations keep what you typed until you change them.
        </p>
      ) : null}

      {draft.length >= MAX_CUSTOM_FIELDS ? (
        <p className="text-xs text-muted">
          You&rsquo;ve reached the maximum of {MAX_CUSTOM_FIELDS} extra fields.
        </p>
      ) : null}
    </SectionPanel>
  );
}
