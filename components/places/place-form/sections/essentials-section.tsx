"use client";

import { Controller, type Control } from "react-hook-form";

import { TagPicker } from "@/components/tags/tag-picker";
import { FormTextField } from "@/components/ui/form-field";
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
  errors: { address?: { message?: string } };
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

      {/* One field per row, at every width. They shared a line while the address
          needed a button beside it; the lookup is a magnifier inside the box now,
          and a search field that returns a list of matches wants the full width
          for them. The `sm:grid-cols-1` that used to be here said nothing a
          one-column grid was not already saying. */}
      <div className="grid gap-4">
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

      {/*
        Tags, where the Category select used to be.

        Up here rather than in a fold of its own because this is what says what
        kind of place this is — the question the Category select was asking, now
        answered by a control that lets a stockist carrying three product lines
        say so without needing three pins at one address. The fold it replaces is
        gone: two controls asking one question, with the better one hidden, is
        what made the dialog incoherent in the first place.

        Creating a tag is the picker's own first row, so there is no button here.
        Renaming, recolouring and removing stay in Settings, where the usage
        counts are and where removal's consequences belong.
      */}
      <Controller
        control={control}
        name="tags"
        render={({ field }) => (
          <TagPicker
            map={map}
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      />

      {/*
        A row of its own, full width.

        It used to share a two-column row with the Category select, which gave a
        horizontally scrolling strip of pins half the dialog — so with eight
        custom pins on top of six built-in ones, most of the map's own pins were
        off the end of a scroller nothing announced. A picture picker needs the
        width; the picker above it does not.
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
