"use client";

import { SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { useMap } from "@/lib/query/maps";
import { usePlaces } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { PlaceCountBadge } from "./place-count-badge";
import { PlaceEditDialog } from "./place-form/place-edit-dialog";
import { PlaceList } from "./place-list";
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const categoriesById = useMemo(
    () => new Map(map.categories.map((category) => [category.id, category])),
    [map.categories],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return places.filter((place) => {
      if (categoryId === NO_CATEGORY && place.category) return false;
      if (categoryId && categoryId !== NO_CATEGORY && place.category !== categoryId) {
        return false;
      }

      if (!needle) return true;

      return (
        place.name.toLowerCase().includes(needle) ||
        place.address.toLowerCase().includes(needle)
      );
    });
  }, [places, query, categoryId]);

  const isFiltered = visible.length !== places.length;
  const editingPlace = places.find((place) => place.id === editingId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Add, edit and organise the places on this map."
        actions={
          <>
            <PlaceCountBadge count={places.length} limit={placeLimit} />
            <LinkButton
              variant="secondary"
              href={`/maps/${map.id}/places/import`}
            >
              Import from CSV
            </LinkButton>
          </>
        }
      />

      {places.length > 0 ? (
        <PlacesToolbar
          query={query}
          categoryId={categoryId}
          categories={map.categories}
          onQueryChange={setQuery}
          onCategoryChange={setCategoryId}
        />
      ) : null}

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
          description="No locations match that search. Try a different name, or clear the filters."
        />
      ) : (
        <PlaceList
          mapId={map.id}
          places={visible}
          categoriesById={categoriesById}
          selectedPlaceId={editingId}
          onSelect={setEditingId}
          onEdit={setEditingId}
        />
      )}

      <PlaceEditDialog
        map={map}
        place={editingPlace}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
