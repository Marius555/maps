"use client";

import { Controller, type Control } from "react-hook-form";

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
 * something a visitor might like to know; these are what makes it a pin on a map
 * at all, and folding them away would hide the form's whole subject.
 *
 * **The map is first.** It is the answer to "is this pin in the right place",
 * which is the question that brings anyone to this dialog — and the field that
 * used to lead, the address, is now beside the map it moves rather than above a
 * fold. It also means the hint under the address can be dropped here: the map
 * says "drag the pin, or click the map" in its own caption, right there.
 *
 * The coordinates have moved out entirely, into a fold of their own. They are
 * the escape hatch for a pin the geocoder put in the wrong country, and an
 * escape hatch does not belong in the four things everybody reads.
 */
export function EssentialsSection({
  map,
  place,
  control,
  errors,
  lat,
  lng,
  icon,
  onMove,
}: {
  map: AppMap;
  place: Place;
  control: Control<PlaceFormValues>;
  errors: { address?: { message?: string }; category?: { message?: string } };
  lat: number;
  lng: number;
  /**
   * The form's live pin, watched in `place-form.tsx` beside `lat`/`lng` and for
   * the same reason: the map above draws the draft, not the stored row.
   */
  icon: string;
  /**
   * The form's one position setter, shared with the Coordinates fold — two
   * sections move this pin, and two copies of "write lat and lng, mark dirty"
   * is how they would come to disagree about the second half.
   */
  onMove: (coords: { lat: number; lng: number }) => void;
}) {
  const categoryOptions = [
    { id: "", label: "No category" },
    ...map.categories.map((category) => ({
      id: category.id,
      label: category.label,
    })),
  ];

  return (
    <div className="space-y-4">
      <PinMapField
        map={map}
        place={place}
        lat={lat}
        lng={lng}
        icon={icon}
        onChange={onMove}
      />

      {/* One field per row. They shared a line while the address needed a button
          beside it; the lookup is a magnifier inside the box now, and a search
          field that returns a list of matches wants the full width for them. */}
      <div className="grid gap-4 sm:grid-cols-1">
        <FormTextField control={control} name="name" label="Name" />

        <Controller
          control={control}
          name="address"
          render={({ field }) => (
            <AddressSearchField
              mapId={map.id}
              // Not "Address". The stored address is already on the row and is
              // edited in this same box — what the box is *for* here is finding
              // somewhere new to put a pin that is in the wrong place, which is
              // the only reason anyone opens this dialog and types in it.
              label="Find New Location"
              value={field.value}
              error={errors.address?.message}
              // The map above already says it, in its own caption.
              hint={null}
              onChange={field.onChange}
              onPick={(candidate) => {
                // The matched label replaces what was typed, so the stored
                // address is the one the coordinates actually belong to.
                if (candidate.label) field.onChange(candidate.label);
                onMove({
                  lat: roundCoord(candidate.lat),
                  lng: roundCoord(candidate.lng),
                });
              }}
            />
          )}
        />
      </div>

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

      {/*
        A row of its own, full width.

        It used to share a two-column row with the category, which gave a
        horizontally scrolling strip of pins half the dialog — so with eight
        custom pins on top of six built-in ones, most of the map's own pins were
        off the end of a scroller nothing announced. A picture picker needs the
        width; a select does not.
      */}
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
  );
}
