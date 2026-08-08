"use client";

import { Pencil, Trash2 } from "lucide-react";

import { CategoryDot } from "@/components/categories/category-badge";
import { IconButton } from "@/components/ui/icon-button";
import { formatCoords } from "@/lib/map/geo";
import type { MapCategory, Place } from "@/lib/repositories/types";
import { PlaceStatusChip } from "./place-status-chip";

/**
 * One location in the list.
 *
 * The actions used to be two full-width text buttons that ate about half the row.
 * They are now icon-only and hidden until the row is hovered, focused or
 * selected, so the row is mostly the thing it is about.
 *
 * Hidden with `opacity`, never `hidden` or `sr-only`: the buttons must stay in the
 * DOM and in the tab order. `group-focus-within` is what makes them appear for a
 * keyboard user — without it this would be a mouse-only feature.
 */
export function PlaceListItem({
  place,
  category,
  isSelected,
  isDeleting,
  onSelect,
  onEdit,
  onDelete,
}: {
  place: Place;
  category: MapCategory | undefined;
  isSelected: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      data-selected={isSelected || undefined}
      className="group flex h-12 items-center gap-1 rounded-xl px-2 transition-colors hover:bg-default data-selected:bg-accent-soft"
    >
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 flex-col justify-center rounded-lg text-left outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
        aria-current={isSelected ? "true" : undefined}
        onClick={onSelect}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {category ? <CategoryDot color={category.color} /> : null}
          <span className="truncate text-sm font-medium text-foreground">
            {place.name}
          </span>
          <PlaceStatusChip status={place.geocodeStatus} />
        </span>
        <span className="truncate text-xs tabular-nums text-muted">
          {place.address || formatCoords(place.lat, place.lng)}
        </span>
      </button>

      {/*
       * `group-focus-within`, not plain `focus-within`: focus lands on the row's
       * select button first, which is a sibling of this div. Without the group
       * variant a keyboard user would tab into buttons that are still invisible.
       */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-data-selected:opacity-100">
        <IconButton label={`Edit ${place.name}`} icon={Pencil} onPress={onEdit} />
        <IconButton
          label={`Delete ${place.name}`}
          icon={Trash2}
          isPending={isDeleting}
          onPress={onDelete}
        />
      </div>
    </li>
  );
}
