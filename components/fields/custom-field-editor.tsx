"use client";

import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import type { MapField, Place } from "@/lib/repositories/types";
import {
  DEFAULT_CUSTOM_FIELD_DISPLAY,
  DEFAULT_CUSTOM_FIELD_TYPE,
  MAX_CUSTOM_FIELDS,
  newCustomFieldId,
} from "@/lib/validation/field.schema";
import { CustomFieldExplainer } from "./custom-field-explainer";
import { CustomFieldRow } from "./custom-field-row";

/**
 * Extra fields, defined once for the whole map and filled in per location.
 *
 * The draft and its save belong to the Tags & fields dialog, which saves this
 * and the filters with one button (VocabularyDialog).
 *
 * The order of this list is the order the card renders, which is why rows can
 * be removed but the list is otherwise left in the order it was built — an owner
 * arranging their card is arranging this.
 */
export function CustomFieldEditor({
  draft,
  places,
  onChange,
}: {
  draft: MapField[];
  places: Place[];
  onChange: (next: MapField[]) => void;
}) {
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

  // The row just added takes focus, so "Add field" then typing names it.
  const [addedId, setAddedId] = useState<string | null>(null);

  const atLimit = draft.length >= MAX_CUSTOM_FIELDS;

  const addField = () => {
    // Fresh id, never reused: a place's answers are keyed by this, so a
    // repeated id would hand a new field the old one's values.
    const id = newCustomFieldId();
    setAddedId(id);
    onChange([
      ...draft,
      {
        id,
        label: "",
        type: DEFAULT_CUSTOM_FIELD_TYPE,
        showAs: DEFAULT_CUSTOM_FIELD_DISPLAY,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <CustomFieldExplainer />

      {draft.length > 0 ? (
        <ul className="space-y-3">
          {draft.map((field, index) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              autoFocus={field.id === addedId}
              usageCount={usageByField.get(field.id) ?? 0}
              onChange={(next) =>
                onChange(
                  draft.map((existing, position) => (position === index ? next : existing)),
                )
              }
              onRemove={() => onChange(draft.filter((_, position) => position !== index))}
            />
          ))}
        </ul>
      ) : null}

      <Button
        size="sm"
        variant={draft.length === 0 ? "primary" : "secondary"}
        isDisabled={atLimit}
        onPress={addField}
      >
        <Plus aria-hidden="true" className="size-4" />
        Add field
      </Button>

      {draft.length > 0 ? (
        <p className="text-xs text-muted">
          {atLimit
            ? `You’ve reached the maximum of ${MAX_CUSTOM_FIELDS} extra fields. `
            : null}
          Fields appear on the card in this order. Removing one hides it from your
          published map; locations keep what you typed until you change them.
        </p>
      ) : null}
    </div>
  );
}
