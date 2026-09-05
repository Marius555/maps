"use client";

import { useState } from "react";

import { AddressSearchField } from "@/components/places/place-form/address-search-field";
import { roundCoord } from "@/lib/map/geo";
import { useUpdatePlace } from "@/lib/query/places";
import type { Place } from "@/lib/repositories/types";
import { SlotShell } from "./slot-shell";

/**
 * The address slot, which is the one that can also move the pin.
 *
 * `AddressSearchField` rather than a plain box, because a location with no
 * address usually got one dropped on the map by hand and the address is exactly
 * what would fix where it sits. Search-on-submit, so this is one geocoder
 * request when the magnifier is pressed and never one per keystroke — the rule
 * §7 states and CLAUDE.md's "autocomplete is not in v1" exists to hold.
 *
 * Picking a match writes the coordinates as well as the words, and marks the
 * position `manual` — `PlaceForm` does the same thing for the same reason: a
 * position somebody chose deliberately must not be overwritten by a later
 * geocode pass. Typing an address and pressing Add without picking anything
 * writes only the words, leaving the pin exactly where its owner put it.
 */
export function SlotAddressForm({
  mapId,
  place,
  title,
  onDone,
}: {
  mapId: string;
  place: Place;
  title: string;
  onDone: () => void;
}) {
  const updatePlace = useUpdatePlace(mapId);
  const [address, setAddress] = useState(place.address);
  /** The match that was picked, if any — its coordinates travel with the words. */
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  const submit = async () => {
    try {
      await updatePlace.mutateAsync({
        placeId: place.id,
        input: {
          address: address.trim(),
          ...(picked
            ? { lat: picked.lat, lng: picked.lng, geocodeStatus: "manual" as const }
            : {}),
        },
      });

      onDone();
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SlotShell
      title={title}
      error={updatePlace.error}
      isPending={updatePlace.isPending}
      isDisabled={!address.trim()}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <AddressSearchField
        mapId={mapId}
        label="Address"
        value={address}
        // The map is right there behind this popover, so the sentence the
        // dialog's own field carries — "or drag the pin" — is advice about a
        // gesture the reader can make without closing anything.
        hint="Or drag the pin on the map to place it exactly."
        onChange={(next) => {
          setAddress(next);
          // Typed over, so the coordinates that came with the last match are no
          // longer the ones these words describe.
          setPicked(null);
        }}
        onPick={(candidate) => {
          // The matched label replaces what was typed, so the stored address is
          // the one the coordinates actually belong to.
          if (candidate.label) setAddress(candidate.label);
          setPicked({
            lat: roundCoord(candidate.lat),
            lng: roundCoord(candidate.lng),
          });
        }}
      />
    </SlotShell>
  );
}
