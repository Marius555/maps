"use client";

import { useWatch, type Control } from "react-hook-form";

import { FormTextArea } from "@/components/ui/form-field";
import type { PhotoSlot } from "@/lib/photos/save-plan";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { PhotoGalleryField } from "../photo-gallery-field";
import { FormSection } from "./form-section";

/**
 * The two things that make a card worth opening, and neither is required.
 *
 * Both come from the draft now. Photos used to upload the moment they were
 * picked, so the summary had to read them off the *saved* place while the
 * description came from the live form — two sources for one line, on the honest
 * grounds that the two really did save at different times. They no longer do
 * (`photo-gallery-field.tsx`), so the line counts what is on screen and says the
 * same thing about both halves.
 */
export function MediaSection({
  photos,
  control,
  hasError,
  onPhotosChange,
}: {
  photos: PhotoSlot[];
  control: Control<PlaceFormValues>;
  hasError?: boolean;
  onPhotosChange: (next: PhotoSlot[]) => void;
}) {
  const description = useWatch({ control, name: "description" });

  return (
    <FormSection
      title="Photos and description"
      summary={summarise(photos.length, description)}
      hasError={hasError}
    >
      <PhotoGalleryField value={photos} onChange={onPhotosChange} />

      <FormTextArea
        control={control}
        name="description"
        label="Description"
      />
    </FormSection>
  );
}

/**
 * Counted rather than "2 of 2", because these two are not a pair of boxes to
 * fill: eight photos and no description is a finished location, and "1 of 2"
 * would read as half done.
 */
function summarise(photos: number, description: string | undefined): string {
  const parts: string[] = [];

  if (photos > 0) parts.push(photos === 1 ? "1 photo" : `${photos} photos`);
  if (description?.trim()) parts.push("description");

  return parts.length === 0 ? "Not set" : parts.join(" · ");
}
