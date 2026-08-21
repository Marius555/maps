"use client";

import { Controller, type Control, type UseFormSetValue } from "react-hook-form";

import { CoordinateFields } from "@/components/places/coordinate-fields";
import { FormTextField } from "@/components/ui/form-field";
import { SelectControl } from "@/components/ui/select-control";
import { roundCoord } from "@/lib/map/geo";
import type { AppMap, Place } from "@/lib/repositories/types";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { AddressSearchField } from "../address-search-field";
import { PinMapField } from "../pin-map-field";
import { PinField } from "../pin-field";

/**
 * The part of a location that has to be right: what it is called, and where it is.
 *
 * Always open, and the only section that is. Everything else on a location is
 * something a visitor might like to know; these four are what makes it a pin on a
 * map at all, and folding them away would hide the form's whole subject.
 */
export function EssentialsSection({
  map,
  place,
  control,
  errors,
  setValue,
  lat,
  lng,
}: {
  map: AppMap;
  place: Place;
  control: Control<PlaceFormValues>;
  errors: { address?: { message?: string }; category?: { message?: string } };
  setValue: UseFormSetValue<PlaceFormValues>;
  lat: number;
  lng: number;
}) {
  const categoryOptions = [
    { id: "", label: "No category" },
    ...map.categories.map((category) => ({
      id: category.id,
      label: category.label,
    })),
  ];

  const setPosition = (coords: { lat: number; lng: number }) => {
    setValue("lat", coords.lat, { shouldDirty: true });
    setValue("lng", coords.lng, { shouldDirty: true });
  };

  return (
    <div className="space-y-4">
      <FormTextField
        control={control}
        name="name"
        label="Name"
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
              setPosition({
                lat: roundCoord(candidate.lat),
                lng: roundCoord(candidate.lng),
              });
            }}
          />
        )}
      />

      <PinMapField
        map={map}
        place={place}
        lat={lat}
        lng={lng}
        onChange={setPosition}
      />

      <CoordinateFields lat={lat} lng={lng} onChange={setPosition} />

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <PinField
              value={field.value}
              pinIcons={map.pinIcons}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
}
