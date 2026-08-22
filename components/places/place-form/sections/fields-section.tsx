"use client";

import { Input, Label, TextField } from "@heroui/react";
import { Controller, type Control } from "react-hook-form";

import type { MapField } from "@/lib/repositories/types";
import { MAX_FIELD_VALUE_LENGTH } from "@/lib/validation/field.schema";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { FormSection, filledSummary } from "./form-section";

/** What the browser should offer, and how the value should be keyboarded. */
const INPUT_TYPE: Record<MapField["type"], "text" | "url" | "tel" | "email"> = {
  text: "text",
  url: "url",
  tel: "tel",
  email: "email",
};

/**
 * This location's answers to the map's own extra fields.
 *
 * Rendered from the map's definitions in their order, not from whatever keys
 * this place happens to have: a location that has never been filled in still
 * needs a box for every field, and a location holding a value for a field the
 * owner deleted should stop offering to edit it. Publishing applies the same
 * narrowing, so what is editable here is exactly what a visitor can see.
 *
 * Bound through `Controller` on the whole record rather than one `Controller`
 * per field. The form value is a single object keyed by field id, and there is
 * no fixed set of names to register — the map decides them at runtime.
 */
export function FieldsSection({
  control,
  fields,
}: {
  control: Control<PlaceFormValues>;
  fields: MapField[];
}) {
  // Omitted rather than shown empty, like the tags section: an owner who has
  // defined no extra fields has nothing to fill in here.
  if (fields.length === 0) return null;

  return (
    <Controller
      control={control}
      name="fields"
      render={({ field }) => {
        const values = field.value ?? {};

        return (
          <FormSection
            title="Extra fields"
            summary={filledSummary(fields.map((definition) => values[definition.id]))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((definition) => (
                <TextField
                  key={definition.id}
                  fullWidth
                  type={INPUT_TYPE[definition.type]}
                  maxLength={MAX_FIELD_VALUE_LENGTH}
                  value={values[definition.id] ?? ""}
                  onChange={(value) =>
                    field.onChange({ ...values, [definition.id]: value })
                  }
                >
                  <Label>{definition.label || "Unnamed field"}</Label>
                  <Input />
                </TextField>
              ))}
            </div>
          </FormSection>
        );
      }}
    />
  );
}
