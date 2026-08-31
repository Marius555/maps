"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useSavePlacePhotos } from "@/lib/query/photo";
import { useUpdatePlace } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import {
  placeFormSchema,
  type PlaceFormValues,
} from "@/lib/validation/place.schema";
import type { PhotoSlot } from "@/lib/photos/save-plan";
import { emptyHours } from "@/packages/shared/hours";
import { ContactSection } from "./sections/contact-section";
import { CoordinatesSection } from "./sections/coordinates-section";
import { EssentialsSection } from "./sections/essentials-section";
import { FieldsSection } from "./sections/fields-section";
import { HoursSection } from "./sections/hours-section";
import { MediaSection } from "./sections/media-section";
import { TagsSection } from "./sections/tags-section";

/**
 * Edits one location.
 *
 * Composition and submit; every field lives in a section beside it. What used to
 * be here was one flat stack of eleven controls in a 520px dialog, which is the
 * form the user could not make sense of — nothing separated the four fields that
 * decide whether this is a working pin from the seven that decorate it.
 *
 * **Coordinates are typed now, and that is a deliberate reversal.** This file
 * used to say "Coordinates are shown but not typed: nobody edits a latitude by
 * hand", and mostly nobody does — but the exception is the case that matters,
 * which is a pin the geocoder put in the wrong country. Then the coordinates are
 * the only way in, and the advice this form gave instead ("drag the pin on the
 * map") pointed at a map that did not exist in the dialog. There is one now, and
 * the boxes underneath it, and either can move the pin.
 *
 * **Everything in here is a draft, including the photos.** They were the one
 * exception — uploaded the moment they were picked, so Cancel did not undo them
 * and Save did not save them. They are `PhotoSlot`s in local state now, held
 * beside the form rather than inside it because a `File` has no business in a
 * zod schema, and written by `useSavePlacePhotos` on submit.
 */
export function PlaceForm({
  map,
  place,
  onSaved,
  onCancel,
}: {
  map: AppMap;
  place: Place;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const updatePlace = useUpdatePlace(map.id);
  const savePhotos = useSavePlacePhotos(map.id);

  /*
   * The gallery, as it will be. Seeded from the saved row, and reset with the
   * rest of the form by the `key` the dialog puts on this component.
   */
  const [photos, setPhotos] = useState<PhotoSlot[]>(() => galleryOf(place));

  const {
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlaceFormValues>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: {
      name: place.name,
      address: place.address,
      category: place.category,
      tags: place.tags,
      fields: place.fields,
      icon: place.icon,
      description: place.description ?? "",
      phone: place.phone ?? "",
      email: place.email ?? "",
      url: place.url ?? "",
      // The form always holds seven days; `null` on the place means none set yet.
      hours: place.hours ?? emptyHours(),
      lat: place.lat,
      lng: place.lng,
    },
  });

  // useWatch, not watch(): watch() returns a fresh function each render, which
  // the React Compiler can't memoize, so it opts the whole component out.
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });
  // Watched for the map above, which draws the draft rather than the saved row.
  const icon = useWatch({ control, name: "icon" });

  /*
   * Moved up out of the essentials, because two sections write the position now:
   * the map and the boxes under "Coordinates". One setter, so a drag and a typed
   * number cannot mark the form dirty in different ways.
   */
  const setPosition = (coords: { lat: number; lng: number }) => {
    setValue("lat", coords.lat, { shouldDirty: true });
    setValue("lng", coords.lng, { shouldDirty: true });
  };

  /*
   * The fields first, then the photos.
   *
   * Both have to happen, and one of them can fail — so the question is which
   * order leaves a recoverable dialog. The field PATCH is idempotent, so a photo
   * failure leaves a form that can simply be saved again; the reverse would
   * leave uploaded photos behind a PATCH that never ran, with nothing on screen
   * saying which half landed.
   */
  const onSubmit = handleSubmit(async (values) => {
    try {
      await updatePlace.mutateAsync({
        placeId: place.id,
        input: {
          ...values,
          // Coordinates set here were placed deliberately — by drag, by typing,
          // or by picking a match — so a later geocode pass must not overwrite
          // them.
          geocodeStatus:
            values.lat === place.lat && values.lng === place.lng
              ? place.geocodeStatus
              : "manual",
        },
      });

      await savePhotos.mutateAsync({
        placeId: place.id,
        slots: photos,
        savedIds: place.photoIds,
        // Every stage, not just the last one — see the hook. A file that has
        // been uploaded stops being a pending file immediately, so a failure
        // further along leaves a Save that can be pressed again without sending
        // it twice.
        onPlace: (written) => setPhotos(galleryOf(written)),
      });

      onSaved?.();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {updatePlace.error ? <ErrorMessage error={updatePlace.error} /> : null}
      {savePhotos.error ? <ErrorMessage error={savePhotos.error} /> : null}

      <EssentialsSection
        map={map}
        place={place}
        control={control}
        errors={errors}
        lat={lat}
        lng={lng}
        icon={icon}
        onMove={setPosition}
      />

      {/* Collapsed by default, and forced open by an error in them — a message
          nobody can see is the same as no message. */}
      <div className="space-y-2">
        {/* First of the folds, because it is the one that belongs to the map
            directly above it — but folded, because it is the rare repair rather
            than a field anybody fills in. */}
        <CoordinatesSection lat={lat} lng={lng} onChange={setPosition} />

        <ContactSection
          control={control}
          hasError={Boolean(errors.phone || errors.email || errors.url)}
        />
        {/* Both render nothing when the map defines none, so a map that never
            set either up sees the form it always saw. */}
        <TagsSection control={control} groups={map.tagGroups} />
        <FieldsSection control={control} fields={map.fields} />
        <HoursSection control={control} hasError={Boolean(errors.hours)} />
        <MediaSection
          photos={photos}
          control={control}
          hasError={Boolean(errors.description)}
          onPhotosChange={setPhotos}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="tertiary" onPress={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" isPending={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/**
 * A stored row's photos as gallery slots.
 *
 * Shared by the initial state and the resync during a save, so "what the row
 * holds" is spelled once — two copies would be two chances for the saved gallery
 * and the drafted one to disagree about their own shape.
 */
function galleryOf(place: Place): PhotoSlot[] {
  return place.photoIds.map((id, index) => ({
    kind: "saved",
    id,
    url: place.photoUrls[index],
  }));
}
