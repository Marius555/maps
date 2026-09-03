"use client";

import { Input, Label, SearchField } from "@heroui/react";
import type { ReactNode } from "react";

import { TagFilterMenu } from "@/components/tags/tag-filter-menu";
import { SelectControl } from "@/components/ui/select-control";
import {
  PLACE_FILTERS,
  PLACE_FILTER_LABELS,
  type PlaceFilter,
} from "@/lib/places/place-filters";
import type { MapTagGroup } from "@/lib/repositories/types";

/**
 * Filters the locations list. Client-side — the whole list is already loaded.
 *
 * The status picker is the one that makes a bad import survivable. Search can
 * only find a location you already know the name of; after a 300-row import the
 * thing you need is every row the geocoder was unsure about, and nothing on the
 * page could ask for that.
 *
 * It also carries the page's actions, which used to sit opposite a "Locations"
 * heading that only repeated the sidebar. **The row renders even with no places
 * on the map**, and only its filters are conditional: the actions include Import
 * locations, so a toolbar that waited for a first location would hide the button
 * on exactly the map that needs it.
 */
export function PlacesToolbar({
  query,
  filter,
  tagGroups,
  tagIds,
  hasPlaces,
  actions,
  onQueryChange,
  onFilterChange,
  onTagsChange,
}: {
  query: string;
  filter: PlaceFilter;
  /** The map's filter vocabulary — what the Tags menu offers. */
  tagGroups: MapTagGroup[];
  tagIds: ReadonlySet<string>;
  /** Filters are pointless with nothing to filter; the actions are not. */
  hasPlaces: boolean;
  actions?: ReactNode;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: PlaceFilter) => void;
  onTagsChange: (tagIds: Set<string>) => void;
}) {
  const filterOptions = PLACE_FILTERS.map((value) => ({
    id: value,
    label: PLACE_FILTER_LABELS[value],
  }));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {hasPlaces ? (
        <>
          <SearchField
            fullWidth
            value={query}
            onChange={onQueryChange}
            className="sm:min-w-56 sm:flex-1"
          >
            <Label>Search locations</Label>
            <Input placeholder="Name or address" />
          </SearchField>

          <div className="sm:w-48">
            <SelectControl
              label="Show"
              options={filterOptions}
              value={filter}
              onChange={(value) => onFilterChange(value as PlaceFilter)}
            />
          </div>

          {/* A button rather than a labelled select, because a location wears
              several tags and one value cannot ask that question. It renders
              nothing at all on a map with no tags. */}
          <TagFilterMenu
            groups={tagGroups}
            selected={tagIds}
            onChange={onTagsChange}
          />
        </>
      ) : null}

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
