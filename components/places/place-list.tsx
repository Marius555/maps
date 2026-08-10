"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { isOptimisticPlaceId, useDeletePlace } from "@/lib/query/places";
import type { MapCategory, Place } from "@/lib/repositories/types";
import { DeletePlaceDialog } from "./delete-place-dialog";
import { PlaceListEmpty } from "./place-list-empty";
import { PlaceListItem } from "./place-list-item";

export function PlaceList({
  mapId,
  places,
  categoriesById,
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
  selectedPlaceId: string | null;
  /**
   * Locations whose address is still being looked up, from whoever dropped the
   * pin. Optional: the Locations page renders saved rows and never has any.
   */
  pendingAddressIds?: ReadonlySet<string>;
  /** Locations whose lookup answered with nothing. Optional for the same reason. */
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
      <ul className="space-y-0.5">
        {/*
         * `initial={false}` so opening a map with 300 locations doesn't fade all
         * 300 in — only rows that appear *after* the list is on screen animate,
         * which is exactly the set the user did something to.
         */}
        <AnimatePresence initial={false}>
          {places.map((place) => (
            <PlaceListItem
              key={place.id}
              place={place}
              category={categoriesById.get(place.category)}
              isSelected={place.id === selectedPlaceId}
              /*
               * Two windows, one skeleton. The temporary id covers the row that
               * exists only in the cache while its create is in flight; the set
               * covers the reverse geocode that runs once the row is real.
               */
              isAddressPending={
                isOptimisticPlaceId(place.id) ||
                (pendingAddressIds?.has(place.id) ?? false)
              }
              hasAddressFailed={failedAddressIds?.has(place.id) ?? false}
              isDeleting={
                deletePlace.isPending && deletePlace.variables === place.id
              }
              onSelect={() => onSelect(place.id)}
              onEdit={() => onEdit(place.id)}
              onDelete={() => setPendingDeleteId(place.id)}
              onRetryAddress={
                onRetryAddress ? () => onRetryAddress(place.id) : undefined
              }
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
