"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import type { MapCategory, Place } from "@/lib/repositories/types";
import { useDeletePlace } from "@/lib/query/places";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { DeletePlaceDialog } from "./delete-place-dialog";
import { PlaceListEmpty } from "./place-list-empty";
import { PlaceListItem } from "./place-list-item";

/**
 * The Locations tab's list: flat, search-filtered, no grouping.
 *
 * The editor sidebar used to render through this too, twice over — once per
 * group and once for the loose rows — which is what made a location's row live
 * in a different component depending on its `groupId`, and moving between the
 * two impossible to animate. That panel builds its own single list now
 * (components/editor/locations-panel/locations-list.tsx) out of the same
 * `PlaceListItem` rows, so a location still looks and behaves identically in
 * both places.
 *
 * What is left here is genuinely flat: a page-width list of every location that
 * matches the search, with no groups to belong to and nothing to drop onto.
 */
export function PlaceList({
  mapId,
  places,
  categoriesById,
  pinIcons,
  selectedPlaceId,
  pendingAddressIds,
  failedAddressIds,
  onSelect,
  onEdit,
  onRetryAddress,
}: {
  mapId: string;
  places: Place[];
  categoriesById: Map<string, MapCategory>;
  /** The map's own pins, so a row can draw a `custom:<id>` one. */
  pinIcons: CustomPinIcon[];
  selectedPlaceId: string | null;
  /**
   * Address lookups in flight, and ones that came back empty.
   *
   * These were never passed here, which made three things `PlaceListItem`
   * already implements dead on this route: the pending skeleton, the "Couldn't
   * find an address" line, and the "Find address again" action — the last of
   * which is unreachable without `hasAddressFailed`. The editor sidebar has
   * always passed them (locations-list.tsx); this list simply never caught up.
   */
  pendingAddressIds?: ReadonlySet<string>;
  failedAddressIds?: ReadonlySet<string>;
  onSelect: (placeId: string) => void;
  onEdit: (placeId: string) => void;
  onRetryAddress?: (placeId: string) => void;
}) {
  const deletePlace = useDeletePlace(mapId);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (places.length === 0) return <PlaceListEmpty />;

  // Looked up rather than stored, so the dialog can't hold a stale copy of a
  // place that has since been renamed elsewhere.
  const pendingDelete =
    places.find((place) => place.id === pendingDeleteId) ?? null;

  return (
    <>
      <ul>
        {/*
         * `initial={false}` so opening a map with 300 locations doesn't fade all
         * 300 in — only rows that appear *after* the list is on screen, which is
         * exactly the set the user did something to.
         */}
        <AnimatePresence initial={false}>
          {places.map((place) => (
            <PlaceListItem
              key={place.id}
              place={place}
              category={categoriesById.get(place.category)}
              pinIcons={pinIcons}
              isSelected={place.id === selectedPlaceId}
              isAddressPending={pendingAddressIds?.has(place.id) ?? false}
              hasAddressFailed={failedAddressIds?.has(place.id) ?? false}
              onSelect={() => onSelect(place.id)}
              onEdit={() => onEdit(place.id)}
              onRetryAddress={
                onRetryAddress ? () => onRetryAddress(place.id) : undefined
              }
              onDelete={() => setPendingDeleteId(place.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <DeletePlaceDialog
        place={pendingDelete}
        isDeleting={deletePlace.isPending}
        error={deletePlace.error}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          if (!pendingDeleteId) return;

          await deletePlace.mutateAsync(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </>
  );
}
