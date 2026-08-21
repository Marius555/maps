"use client";

import { Input, Label, SearchField } from "@heroui/react";
import type { ReactNode } from "react";

import { SelectControl } from "@/components/ui/select-control";
import {
  PLACE_FILTERS,
  PLACE_FILTER_LABELS,
  type PlaceFilter,
} from "@/lib/places/place-filters";
import type { MapCategory } from "@/lib/repositories/types";

/**
 * Filters the locations list. Client-side — the whole list is already loaded.
 *
 * The status picker is the one that makes a bad import survivable. Search and
 * category can only find a location you already know the name of; after a 300-row
 * import the thing you need is every row the geocoder was unsure about, and
 * nothing on the page could ask for that.
 *
 * It also carries the page's actions, which used to sit opposite a "Locations"
 * heading that only repeated the sidebar. **The row renders even with no places
 * on the map**, and only its filters are conditional: the actions include Import
 * locations, so a toolbar that waited for a first location would hide the button
 * on exactly the map that needs it.
 */
export function PlacesToolbar({
  query,
  categoryId,
  filter,
  categories,
  hasPlaces,
  actions,
  onQueryChange,
  onCategoryChange,
  onFilterChange,
}: {
  query: string;
  categoryId: string;
  filter: PlaceFilter;
  categories: MapCategory[];
  /** Filters are pointless with nothing to filter; the actions are not. */
  hasPlaces: boolean;
  actions?: ReactNode;
  onQueryChange: (query: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onFilterChange: (filter: PlaceFilter) => void;
}) {
  const options = [
    { id: "", label: "All categories" },
    ...categories.map((category) => ({
      id: category.id,
      label: category.label,
    })),
    // Only offered once there is a category to be missing from.
    ...(categories.length > 0
      ? [{ id: "__none", label: "No category" }]
      : []),
  ];

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

          {categories.length > 0 ? (
            <div className="sm:w-48">
              <SelectControl
                label="Category"
                options={options}
                value={categoryId}
                onChange={onCategoryChange}
              />
            </div>
          ) : null}

          <div className="sm:w-48">
            <SelectControl
              label="Show"
              options={filterOptions}
              value={filter}
              onChange={(value) => onFilterChange(value as PlaceFilter)}
            />
          </div>
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
