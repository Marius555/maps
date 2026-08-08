"use client";

import { Input, Label, SearchField } from "@heroui/react";

import { SelectControl } from "@/components/ui/select-control";
import type { MapCategory } from "@/lib/repositories/types";

/** Filters the locations list. Client-side — the whole list is already loaded. */
export function PlacesToolbar({
  query,
  categoryId,
  categories,
  onQueryChange,
  onCategoryChange,
}: {
  query: string;
  categoryId: string;
  categories: MapCategory[];
  onQueryChange: (query: string) => void;
  onCategoryChange: (categoryId: string) => void;
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <SearchField
        fullWidth
        value={query}
        onChange={onQueryChange}
        className="sm:flex-1"
      >
        <Label>Search locations</Label>
        <Input placeholder="Name or address" />
      </SearchField>

      {categories.length > 0 ? (
        <div className="sm:w-56">
          <SelectControl
            label="Category"
            options={options}
            value={categoryId}
            onChange={onCategoryChange}
          />
        </div>
      ) : null}
    </div>
  );
}
