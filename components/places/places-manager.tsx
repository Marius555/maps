"use client";

import { SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAddressResolution } from "@/components/editor/use-address-resolution";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageTitle } from "@/components/ui/page-title";
import {
  matchesFilter,
  matchesTagFilter,
  type PlaceFilter,
} from "@/lib/places/place-filters";
import { useMap } from "@/lib/query/maps";
import { usePlaces } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { tagGroupsInUse, wornTagIds } from "@/lib/tags/tag-usage";
import { tagGroupIndex } from "@/packages/shared/tags";
import { ImportHelpLink } from "./import-help-link";
import { VocabularyButton } from "./manage-vocabulary/vocabulary-button";
import { PlaceCountBadge } from "./place-count-badge";
import { PlaceEditDialog } from "./place-form/place-edit-dialog";
import { PlaceList } from "./place-list";
import { PlaceTable } from "./place-table/place-table";
import { PlacesToolbar } from "./places-toolbar";
import { SheetSyncButton } from "./sheet-sync/sheet-sync-button";
import type { SheetLinkView } from "@/lib/sheet-sync/types";

export function PlacesManager({
  initialMap,
  initialPlaces,
  placeLimit,
  initialFilter = "",
  initialTagIds,
  initialSheetLink,
}: {
  initialMap: AppMap;
  initialPlaces: Place[];
  placeLimit: number;
  /** The map's link to a Google Sheet, or null — resolved with the rest on the server. */
  initialSheetLink: SheetLinkView | null;
  /**
   * What the list opens filtered to, when something sent the visitor here to
   * look at a subset — the Analytics table links every count it reports.
   *
   * Seeded state rather than controlled: the URL says where you arrived, and the
   * toolbar owns it from then on. Making the filter a controlled prop would mean
   * a navigation per click of a filter that is already instant.
   *
   * Validated by the page, so an unreadable value in the address bar becomes "no
   * filter" rather than an empty list nobody can explain.
   */
  initialFilter?: PlaceFilter;
  initialTagIds?: readonly string[];
}) {
  const { data: map = initialMap } = useMap(initialMap.id, initialMap);
  const { data: places = [] } = usePlaces(initialMap.id, initialPlaces);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlaceFilter>(initialFilter);
  const [tagIds, setTagIds] = useState<ReadonlySet<string>>(
    () => new Set(initialTagIds ?? []),
  );
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

  /*
   * Which group each selected tag answers, built once.
   *
   * `matchesTags` needs it per place per keystroke, and it is the *embed's* own
   * function — imported, never reimplemented. Two copies of "OR within a group,
   * AND across groups" is how the owner's filtered list and the visitor's
   * filtered map would come to show different sets of the same locations, which
   * is the case packages/shared/tags.ts names in its opening paragraph.
   */
  const groupOf = useMemo(() => tagGroupIndex(map.tagGroups), [map.tagGroups]);

  const placeIds = useMemo(
    () => new Set(places.map((place) => place.id)),
    [places],
  );

  /*
   * What the Tags menu offers: the vocabulary, narrowed to tags somebody
   * actually wears.
   *
   * Nothing prunes `maps.tagGroups` — deleting a location leaves its tags
   * behind, an import that stopped half way leaves tags for rows it never
   * saved — so the menu offered chips that could only ever return an empty
   * list. Measured on a real map: seven locations, fourteen chips. The publish
   * path has narrowed for the same reason since it was written
   * (`usedTagGroups`), which is why only this screen was wrong; both call the
   * one function now (lib/tags/tag-usage.ts).
   *
   * **Selected tags are kept whether or not anybody wears them**, and that is
   * the part that is not merely a filter. A tag id arrives from the URL, and
   * the last location wearing it may have been deleted since the link was
   * made — narrowed away, the filter would still be applied with no chip left
   * on screen to switch it off.
   *
   * Only the *menu* is narrowed. `listProps.tagGroups` below stays the whole
   * vocabulary, because that is what a row draws its own chips from.
   */
  const filterTagGroups = useMemo(() => {
    const keep = wornTagIds(places);
    for (const id of tagIds) keep.add(id);

    return tagGroupsInUse(map.tagGroups, keep);
  }, [map.tagGroups, places, tagIds]);

  // Otherwise the pending and failed sets grow for the lifetime of the page.
  useEffect(() => {
    retainOnly(placeIds);
  }, [placeIds, retainOnly]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return places.filter((place) => {
      if (!matchesFilter(place, filter)) return false;
      if (!matchesTagFilter(place, tagIds, groupOf)) return false;

      if (!needle) return true;

      return (
        place.name.toLowerCase().includes(needle) ||
        place.address.toLowerCase().includes(needle)
      );
    });
  }, [places, query, filter, tagIds, groupOf]);

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
    tagGroups: map.tagGroups,
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
        filter={filter}
        tagGroups={filterTagGroups}
        tagIds={tagIds}
        hasPlaces={places.length > 0}
        actions={
          <>
            <VocabularyButton map={map} places={places} />
            <SheetSyncButton mapId={map.id} initialLink={initialSheetLink} />
            <LinkButton variant="secondary" href={`/maps/${map.id}/places/import`}>
              Import locations
            </LinkButton>
          </>
        }
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onTagsChange={setTagIds}
      />

      {/*
       * The list and the facts about it, as one block.
       *
       * `space-y-3` rather than the page's own `space-y-6`, because the footer
       * row is a caption on the table above it and not a third section of the
       * page — at 24px it floated between the two and belonged to neither.
       */}
      <div className="space-y-3">
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

        {/*
         * Under the table, not in the toolbar.
         *
         * How full the map is, and where to read about filling it. In the
         * toolbar these competed for the one row that has to hold the filters —
         * they took about 320px between them, which is what made the search
         * field and the Tags button wrap. Underneath, they read as the table's
         * own footer.
         *
         * Only when there is a list. On an empty map `PlaceTable` draws an
         * invitation to add the first location, and "0 of 3,000" under it is a
         * limit nobody is near.
         */}
        {places.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <PlaceCountBadge count={places.length} limit={placeLimit} />

            <ImportHelpLink />

            {/* The one place a filtered count is said. */}
            {isFiltered ? (
              <p className="ml-auto text-xs text-muted" role="status">
                Showing {visible.length} of {places.length} locations.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <PlaceEditDialog
        map={map}
        place={editingPlace}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
