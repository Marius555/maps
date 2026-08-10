"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { SelectControl } from "@/components/ui/select-control";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextArea, FormTextField } from "@/components/ui/form-field";
import { formatCoords, roundCoord } from "@/lib/map/geo";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdatePlace } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import {
  placeFormSchema,
  type PlaceFormValues,
} from "@/lib/validation/place.schema";
import { emptyHours } from "@/packages/shared/hours";
import { AddressSearchField } from "./address-search-field";
import { HoursField } from "./hours-field/hours-field";
import { PhotoField } from "./photo-field";

/**
 * Edits one location.
 *
 * Coordinates are shown but not typed: nobody edits a latitude by hand. They are
 * changed by dragging the pin or by picking an address match, both of which write
 * through this form's state so a save carries them.
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

  const categoryOptions = [
    { id: "", label: "No category" },
    ...map.categories.map((category) => ({
      id: category.id,
      label: category.label,
    })),
  ];

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updatePlace.mutateAsync({
        placeId: place.id,
        input: {
          ...values,
          // Coordinates set here were placed deliberately, by drag or by picking
          // a match, so a later geocode pass must not overwrite them.
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

      <FormTextField
        control={control}
        name="name"
        label="Name"
        placeholder="Corner Shop"
      />

      <Controller
        control={control}
        name="address"
        render={({ field }) => (
          <AddressSearchField
            mapId={map.id}
            value={field.value}
            error={errors.address?.message}
            onChange={field.onChange}
            onPick={(candidate) => {
              // The matched label replaces what was typed, so the stored address
              // is the one the coordinates actually belong to.
              if (candidate.label) field.onChange(candidate.label);
              setValue("lat", roundCoord(candidate.lat), { shouldDirty: true });
              setValue("lng", roundCoord(candidate.lng), { shouldDirty: true });
            }}
          />
        )}
      />

      <p className="text-xs tabular-nums text-muted">
        Pin at {formatCoords(lat, lng)}
      </p>

      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <SelectControl
            label="Category"
            options={categoryOptions}
            value={field.value}
            error={errors.category?.message}
            onChange={field.onChange}
          />
        )}
      />

      <PhotoField mapId={map.id} place={place} />

      <FormTextArea
        control={control}
        name="description"
        label="Description"
        placeholder="Anything a visitor should know."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField control={control} name="phone" label="Phone" type="tel" />
        <FormTextField control={control} name="email" label="Email" type="email" />
      </div>

      <FormTextField
        control={control}
        name="url"
        label="Website"
        type="url"
        placeholder="https://example.com"
      />

      <Controller
        control={control}
        name="hours"
        render={({ field }) => (
          <HoursField
            value={field.value}
            error={errors.hours?.message}
            onChange={field.onChange}
          />
        )}
      />

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
