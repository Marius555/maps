"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useForm, useWatch } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdatePlace } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import {
  placeFormSchema,
  type PlaceFormValues,
} from "@/lib/validation/place.schema";
import { emptyHours } from "@/packages/shared/hours";
import { ContactSection } from "./sections/contact-section";
import { EssentialsSection } from "./sections/essentials-section";
import { HoursSection } from "./sections/hours-section";
import { MediaSection } from "./sections/media-section";

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

      onSaved?.();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {updatePlace.error ? <ErrorMessage error={updatePlace.error} /> : null}

      <EssentialsSection
        map={map}
        place={place}
        control={control}
        errors={errors}
        setValue={setValue}
        lat={lat}
        lng={lng}
      />

      {/* Collapsed by default, and forced open by an error in them — a message
          nobody can see is the same as no message. */}
      <div className="space-y-2">
        <ContactSection
          control={control}
          hasError={Boolean(errors.phone || errors.email || errors.url)}
        />
        <HoursSection control={control} hasError={Boolean(errors.hours)} />
        <MediaSection
          map={map}
          place={place}
          control={control}
          hasError={Boolean(errors.description)}
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
