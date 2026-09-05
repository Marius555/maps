"use client";

import { useWatch, type Control } from "react-hook-form";

import { FormTextArea } from "@/components/ui/form-field";
import type { PhotoSlot } from "@/lib/photos/save-plan";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { LogoField, type LogoDraft } from "../logo-field";
import { PhotoGalleryField } from "../photo-gallery-field";
import { FormSection } from "./form-section";

/**
 * The three things that make a card worth opening, and none is required.
 *
 * All three come from the draft. Photos used to upload the moment they were
 * picked, so the summary had to read them off the *saved* place while the
 * description came from the live form — two sources for one line, on the honest
 * grounds that the two really did save at different times. They no longer do
 * (`photo-gallery-field.tsx`), so the line counts what is on screen and says the
 * same thing about all of them.
 *
 * **The logo is here rather than beside the pin picker in Essentials**, which is
 * the other place it could go: a location's `icon` lives there, and a logo used
 * to be the image on whichever custom pin that named. But that control edits
 * `map.pinIcons` — map data, shared by every location wearing the pin — where
 * this one edits the location's own row. Two controls that look alike and write
 * different tables is the confusion the merge of categories into tags was meant
 * to end, not to repeat. This section is where a location's own pictures are.
 */
export function MediaSection({
  logo,
  photos,
  control,
  hasError,
  onLogoChange,
  onPhotosChange,
}: {
  logo: LogoDraft;
  photos: PhotoSlot[];
  control: Control<PlaceFormValues>;
  hasError?: boolean;
  onLogoChange: (next: LogoDraft) => void;
  onPhotosChange: (next: PhotoSlot[]) => void;
}) {
  const description = useWatch({ control, name: "description" });

  return (
    <FormSection
      title="Logo, photos and description"
      summary={summarise(Boolean(logo), photos.length, description)}
      hasError={hasError}
    >
      <LogoField value={logo} onChange={onLogoChange} />

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
 * Counted rather than "2 of 3", because these are not boxes to fill: eight
 * photos and no description is a finished location, and "1 of 3" would read as
 * half done.
 */
function summarise(
  logo: boolean,
  photos: number,
  description: string | undefined,
): string {
  const parts: string[] = [];

  if (logo) parts.push("logo");
  if (photos > 0) parts.push(photos === 1 ? "1 photo" : `${photos} photos`);
  if (description?.trim()) parts.push("description");

  return parts.length === 0 ? "Not set" : parts.join(" · ");
}
