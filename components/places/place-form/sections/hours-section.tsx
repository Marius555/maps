"use client";

import { Controller, useWatch, type Control } from "react-hook-form";

import { DAY_LABELS_SHORT, isEmptyHours } from "@/packages/shared/hours";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { HoursField } from "../hours-field/hours-field";
import { FormSection } from "./form-section";

/**
 * Seven rows of times, folded away until asked for.
 *
 * The single biggest thing in the dialog, and the one least often edited — it was
 * pushing the save button off the bottom of a phone on every location whether or
 * not anyone intended to touch it.
 *
 * The summary counts open days rather than saying "set". "Set" would be true of
 * a location with one Monday filled in by accident, and the point of the line is
 * to answer "is this finished" without opening it.
 */
export function HoursSection({
  control,
  hasError,
}: {
  control: Control<PlaceFormValues>;
  hasError?: boolean;
}) {
  const hours = useWatch({ control, name: "hours" });

  return (
    <FormSection
      title="Opening hours"
      summary={summarise(hours)}
      hasError={hasError}
    >
      <Controller
        control={control}
        name="hours"
        render={({ field, fieldState }) => (
          <HoursField
            value={field.value}
            error={fieldState.error?.message}
            onChange={field.onChange}
          />
        )}
      />
    </FormSection>
  );
}

function summarise(hours: PlaceFormValues["hours"]): string {
  if (!hours || isEmptyHours(hours)) return "Not set";

  const open = hours
    .map((day, index) => (day ? DAY_LABELS_SHORT[index] : null))
    .filter(Boolean);

  if (open.length === DAY_LABELS_SHORT.length) return "Every day";

  // Named while they fit, counted after that: "Mon, Tue, Wed" is more use than
  // "3 days", and "Mon, Tue, Wed, Thu, Fri, Sat" is less use than "6 days".
  return open.length <= 3
    ? open.join(", ")
    : `${open.length} days`;
}
