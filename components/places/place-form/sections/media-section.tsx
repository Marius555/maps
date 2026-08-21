"use client";

import { useWatch, type Control } from "react-hook-form";

import { FormTextArea } from "@/components/ui/form-field";
import type { AppMap, Place } from "@/lib/repositories/types";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { PhotoField } from "../photo-field";
import { FormSection } from "./form-section";

/**
 * The two things that make a popup worth opening, and neither is required.
 *
 * The photo is not part of form state — it uploads the moment it is picked, for
 * the reason `photo-field.tsx` gives — so the summary reads it off the saved
 * place while the description comes from the live form. Two sources for one line,
 * because the two fields genuinely save at different times, and pretending
 * otherwise would show a photo as missing until the next save.
 */
export function MediaSection({
  map,
  place,
  control,
  hasError,
}: {
  map: AppMap;
  place: Place;
  control: Control<PlaceFormValues>;
  hasError?: boolean;
}) {
  const description = useWatch({ control, name: "description" });

  const has = [
    Boolean(place.photoId || place.photoUrl),
    Boolean(description?.trim()),
  ].filter(Boolean).length;

  return (
    <FormSection
      title="Photo and description"
      summary={has === 0 ? "Not set" : `${has} of 2`}
      hasError={hasError}
    >
      <PhotoField mapId={map.id} place={place} />

      <FormTextArea
        control={control}
        name="description"
        label="Description"
      />
    </FormSection>
  );
}
