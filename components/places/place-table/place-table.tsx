"use client";

import { useState } from "react";

import { useDeletePlace } from "@/lib/query/places";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { tagChipsOf } from "@/packages/shared/tags";
import { DeletePlaceDialog } from "../delete-place-dialog";
import { PlaceListEmpty } from "../place-list-empty";
import { PlaceTableHead } from "./place-table-head";
import { PlaceTableRow } from "./place-table-row";

/**
 * The Locations list, on a screen wide enough to be a table.
 *
 * `Container` gives every page the full width beside the sidebar, and this page
 * spent it on a single column of 48px rows — a 1600px screen showing a name, an
 * address and a menu with a thousand pixels of nothing beside them. Everything
 * else about a location (its tags, whether its pin is trustworthy, whether it
 * has a phone number) was only visible by opening it one at a time.
 *
 * Columns rather than wider cards because the job here is comparison: which of
 * these 300 need attention, which are untagged, which are still missing
 * opening hours. Cards answer that one location at a time; a table answers it by
 * letting the eye run down a column.
 *
 * Below `lg` this is not rendered at all — `PlacesManager` shows the stacked rows
 * instead. Seven columns in 380px is a horizontal scrollbar pretending to be a
 * layout.
 */
export function PlaceTable({
  mapId,
  places,
  tagGroups,
  pinIcons,
  selectedPlaceId,
  pendingAddressIds,
  failedAddressIds,
  className = "",
  onSelect,
  onEdit,
  onRetryAddress,
}: {
  mapId: string;
  places: Place[];
  /**
   * The map's tag vocabulary. The groups rather than a per-place lookup, so the
   * resolution is `tagChipsOf` — the same function the card and the embed use,
   * which is also what drops ids the map no longer defines and what keeps the
   * location's own order, so chip one is the colour its pin is wearing.
   */
  tagGroups: MapTagGroup[];
  /** The map's own pins, so a row can draw a `custom:<id>` one. */
  pinIcons: CustomPinIcon[];
  selectedPlaceId: string | null;
  pendingAddressIds?: ReadonlySet<string>;
  failedAddressIds?: ReadonlySet<string>;
  className?: string;
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
    <div className={className}>
      {/* Its own scroller, so a long address can never push the page sideways
          (CLAUDE.md §8's quality floor). `table-fixed` is deliberately absent:
          the columns should size to what is in them, and `truncate` on the two
          long cells is what stops either running away. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Locations on this map, with their tags, how their pin was placed,
            and what each is still missing.
          </caption>

          <PlaceTableHead />

          <tbody>
            {places.map((place) => (
              <PlaceTableRow
                key={place.id}
                place={place}
                tagChips={tagChipsOf(tagGroups, place.tags)}
                pinIcons={pinIcons}
                isSelected={place.id === selectedPlaceId}
                isAddressPending={pendingAddressIds?.has(place.id)}
                hasAddressFailed={failedAddressIds?.has(place.id)}
                onSelect={() => onSelect(place.id)}
                onEdit={() => onEdit(place.id)}
                onRetryAddress={
                  onRetryAddress ? () => onRetryAddress(place.id) : undefined
                }
                onDelete={() => setPendingDeleteId(place.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
