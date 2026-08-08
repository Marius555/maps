"use client";

import { useState } from "react";

import { useDeletePlace } from "@/lib/query/places";
import type { MapCategory, Place } from "@/lib/repositories/types";
import { DeletePlaceDialog } from "./delete-place-dialog";
import { PlaceListEmpty } from "./place-list-empty";
import { PlaceListItem } from "./place-list-item";

export function PlaceList({
  mapId,
  places,
  categoriesById,
  selectedPlaceId,
  onSelect,
  onEdit,
}: {
  mapId: string;
  places: Place[];
  categoriesById: Map<string, MapCategory>;
  selectedPlaceId: string | null;
  onSelect: (placeId: string) => void;
  onEdit: (placeId: string) => void;
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
        {places.map((place) => (
          <PlaceListItem
            key={place.id}
            place={place}
            category={categoriesById.get(place.category)}
            isSelected={place.id === selectedPlaceId}
            isDeleting={
              deletePlace.isPending && deletePlace.variables === place.id
            }
            onSelect={() => onSelect(place.id)}
            onEdit={() => onEdit(place.id)}
            onDelete={() => setPendingDeleteId(place.id)}
          />
        ))}
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
