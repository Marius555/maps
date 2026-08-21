"use client";

import { SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAddressResolution } from "@/components/editor/use-address-resolution";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageTitle } from "@/components/ui/page-title";
import {
  countNeedingAttention,
  matchesFilter,
  type PlaceFilter,
} from "@/lib/places/place-filters";
import { useMap } from "@/lib/query/maps";
import { usePlaces } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { AttentionBadge } from "./attention-badge";
import { PlaceCountBadge } from "./place-count-badge";
import { PlaceEditDialog } from "./place-form/place-edit-dialog";
import { PlaceList } from "./place-list";
import { PlaceTable } from "./place-table/place-table";
import { PlacesToolbar } from "./places-toolbar";

/** Sentinel for "has no category", distinct from "any category". */
const NO_CATEGORY = "__none";

export function PlacesManager({
  initialMap,
  initialPlaces,
  placeLimit,
}: {
  initialMap: AppMap;
  initialPlaces: Place[];
  placeLimit: number;
}) {
  const { data: map = initialMap } = useMap(initialMap.id, initialMap);
  const { data: places = [] } = usePlaces(initialMap.id, initialPlaces);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [filter, setFilter] = useState<PlaceFilter>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  /*
   * The same hook the editor uses, and the reason the "Find address again"
   * action works here at all.
   *
   * `PlaceListItem` has always been able to draw a pending skeleton, say
   * "Couldn't find an address" and offer the retry — this page just never passed
   * the three props that turn any of it on, so all of it was dead code on the one
   * screen where a customer goes looking for locations that went wrong.
   *
   * The editor can hand the lookup the street it measured off its own tiles; this
   * page has no canvas, so the geocoder answers alone. Less precise, and exactly
   * what `useReverseGeocode` documents as the fallback.
   */
  const { pendingIds, failedIds, resolveAddress, retainOnly } =
    useAddressResolution(map.id);

  const categoriesById = useMemo(
    () => new Map(map.categories.map((category) => [category.id, category])),
    [map.categories],
  );

  const placeIds = useMemo(
    () => new Set(places.map((place) => place.id)),
    [places],
  );

  // Otherwise the pending and failed sets grow for the lifetime of the page.
  useEffect(() => {
    retainOnly(placeIds);
  }, [placeIds, retainOnly]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return places.filter((place) => {
      if (categoryId === NO_CATEGORY && place.category) return false;
      if (categoryId && categoryId !== NO_CATEGORY && place.category !== categoryId) {
        return false;
      }

      if (!matchesFilter(place, filter)) return false;

      if (!needle) return true;

      return (
        place.name.toLowerCase().includes(needle) ||
        place.address.toLowerCase().includes(needle)
      );
    });
  }, [places, query, categoryId, filter]);

  const attention = useMemo(() => countNeedingAttention(places), [places]);

  const isFiltered = visible.length !== places.length;
  const editingPlace = places.find((place) => place.id === editingId) ?? null;

  const retryAddress = (placeId: string) => {
    const place = places.find((candidate) => candidate.id === placeId);
    if (!place) return;

    void resolveAddress(placeId, { lat: place.lat, lng: place.lng }, place.address);
  };

  const listProps = {
    mapId: map.id,
    places: visible,
    categoriesById,
    pinIcons: map.pinIcons,
    selectedPlaceId: editingId,
    pendingAddressIds: pendingIds,
    failedAddressIds: failedIds,
    onSelect: setEditingId,
    onEdit: setEditingId,
    onRetryAddress: retryAddress,
  };

  return (
    <div className="space-y-6">
      <PageTitle>Locations</PageTitle>

      <PlacesToolbar
        query={query}
        categoryId={categoryId}
        filter={filter}
        categories={map.categories}
        hasPlaces={places.length > 0}
        actions={
          <>
            <AttentionBadge
              count={attention}
              isActive={filter === "attention"}
              onShow={() => setFilter(filter === "attention" ? "" : "attention")}
            />
            <PlaceCountBadge count={places.length} limit={placeLimit} />
            <LinkButton
              variant="secondary"
              href={`/maps/${map.id}/places/import`}
            >
              Import locations
            </LinkButton>
          </>
        }
        onQueryChange={setQuery}
        onCategoryChange={setCategoryId}
        onFilterChange={setFilter}
      />

      {isFiltered ? (
        <p className="text-xs text-muted" role="status">
          Showing {visible.length} of {places.length} locations.
        </p>
      ) : null}

      {isFiltered && visible.length === 0 ? (
        <EmptyState
          size="sm"
          icon={SearchX}
          title="No matches"
          description="No locations match those filters. Try a different search, or show all locations."
        />
      ) : (
        <>
          {/* One list, two shapes. The table needs the width to be a table at
              all; below `lg` the stacked rows are still the right answer, and
              they are the same component the editor sidebar uses. */}
          <PlaceTable {...listProps} className="hidden lg:block" />
          <div className="lg:hidden">
            <PlaceList {...listProps} />
          </div>
        </>
      )}

      <PlaceEditDialog
        map={map}
        place={editingPlace}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
