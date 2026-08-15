"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import type { MapCategory, Place } from "@/lib/repositories/types";
import { useDeletePlace } from "@/lib/query/places";
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
              isSelected={place.id === selectedPlaceId}
              onSelect={() => onSelect(place.id)}
              onEdit={() => onEdit(place.id)}
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
