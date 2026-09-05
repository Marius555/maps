"use client";

import { Input, Label, TextField } from "@heroui/react";
import { useState } from "react";

import { useUpdatePlace } from "@/lib/query/places";
import type { MapField, Place } from "@/lib/repositories/types";
import { MAX_FIELD_VALUE_LENGTH } from "@/lib/validation/field.schema";
import { SlotShell } from "./slot-shell";

/**
 * One of the map's own extra fields — the slot a Button bound to a custom field
 * draws when this location left that field blank.
 *
 * Its own file rather than a sixth case in `SlotTextForm`, because a custom
 * field is not a column: it lives inside the place's `fields` record, so the
 * PATCH has to carry the record *whole*. Everything already in there is spread
 * back, which is the difference between filling in a booking link and wiping the
 * other four answers this location had.
 *
 * No react-hook-form and no zod here, deliberately. There is one box, its only
 * rule is a length the input itself enforces, and the `fields` record is not
 * something `placeFormSchema` describes field by field — `placeFieldsSchema` is
 * a `z.record`, so a resolver would be validating a shape this form does not
 * hold. The server still parses it, which is where the guarantee lives.
 *
 * The keyboard type follows the field's own — a `tel` field gets a phone pad on
 * a phone, which is the whole reason `CustomFieldType` exists.
 */
export function SlotFieldForm({
  mapId,
  place,
  field,
  title,
  onDone,
}: {
  mapId: string;
  place: Place;
  field: MapField;
  title: string;
  onDone: () => void;
}) {
  const updatePlace = useUpdatePlace(mapId);
  const [value, setValue] = useState(place.fields[field.id] ?? "");

  const submit = async () => {
    try {
      await updatePlace.mutateAsync({
        placeId: place.id,
        // The whole record, with this one answer written into it. An empty
        // answer is the same as no answer and the schema strips it, so nothing
        // here has to special-case clearing.
        input: { fields: { ...place.fields, [field.id]: value.trim() } },
      });

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
      isDisabled={!value.trim()}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <TextField
        fullWidth
        autoFocus
        type={INPUT_TYPES[field.type]}
        value={value}
        maxLength={MAX_FIELD_VALUE_LENGTH}
        onChange={setValue}
      >
        <Label>{field.label}</Label>
        <Input />
      </TextField>
    </SlotShell>
  );
}

/** What each kind of custom field is typed as — see `FIELD_DESCRIPTIONS`. */
const INPUT_TYPES: Record<MapField["type"], "text" | "url" | "tel" | "email"> = {
  text: "text",
  url: "url",
  tel: "tel",
  email: "email",
};
