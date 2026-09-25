"use client";

import { Description } from "@heroui/react";
import { useWatch, type Control } from "react-hook-form";

import { FormTextArea } from "@/components/ui/form-field";
import type { PhotoSlot } from "@/lib/photos/save-plan";
import { MAX_LOGO_BYTES, MAX_PHOTO_BYTES } from "@/lib/validation/photo";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { kilobytes, LogoField, type LogoDraft } from "../logo-field";
import { megabytes, PhotoGalleryField } from "../photo-gallery-field";
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
 *
 * **Description first, then the pictures side by side.** These were three
 * blocks stacked in the order the fields were added, each with its own paragraph
 * of small print naming the same four formats. The one field anybody types in
 * leads; the logo and the gallery share a row once the fold is wide enough,
 * since both are rows of 64px tiles; and one line under them says what either
 * accepts.
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
      title="Description, logo and photos"
      summary={summarise(Boolean(logo), photos.length, description)}
      hasError={hasError}
    >
      <FormTextArea
        control={control}
        name="description"
        label="Description"
        placeholder="What should visitors know about this location?"
      />

      <div className="flex flex-col gap-2">
        <div className="grid gap-4 @lg:grid-cols-[auto_minmax(0,1fr)] @lg:gap-6">
          <LogoField value={logo} hideHint onChange={onLogoChange} />
          <PhotoGalleryField
            value={photos}
            hideHint
            onChange={onPhotosChange}
          />
        </div>

        <Description>
          JPG, PNG, WebP or AVIF. Logo up to {kilobytes(MAX_LOGO_BYTES)}KB,
          photos up to {megabytes(MAX_PHOTO_BYTES)}MB each; the first photo is
          the cover. They upload when you save.
        </Description>
      </div>
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
