"use client";

import { Skeleton } from "@heroui/react";
import { Pencil, RotateCw, Trash2 } from "lucide-react";

import { PinPreview } from "@/components/map/pin-preview";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import { formatCoords } from "@/lib/map/geo";
import type { Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { pinColorOfChips, type TagChip } from "@/packages/shared/tags";
import { PlaceStatusFlag } from "../place-status-flag";
import { PlaceCompleteness } from "./place-completeness";

/**
 * One location, as a table row.
 *
 * Deliberately not `PlaceListItem` with a density prop. That component is shared
 * with the editor's 320px sidebar, where the whole design — a 48px row, an
 * address on top and a second line under it — exists *because* of the width. A
 * table is a different shape, not a looser one, and teaching one component both
 * would put the sidebar at risk every time this page changed.
 *
 * The name leads. In the sidebar the address leads, because there the row sits
 * beside a map and answers "which pin is this"; here it sits in a list the user
 * came to manage, and the question is "which location is this".
 */
export function PlaceTableRow({
  place,
  tagChips,
  pinIcons,
  isSelected,
  isAddressPending,
  hasAddressFailed,
  onSelect,
  onEdit,
  onRetryAddress,
  onDelete,
}: {
  place: Place;
  /**
   * This location's tags, resolved by the table that holds the map and in the
   * location's own order — the first is what colours its pin.
   */
  tagChips: TagChip[];
  pinIcons: CustomPinIcon[];
  isSelected: boolean;
  isAddressPending?: boolean;
  hasAddressFailed?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRetryAddress?: () => void;
  onDelete: () => void;
}) {
  /** The colour the pin took, so exactly one chip is marked as its source. */
  const pinColor = pinColorOfChips(tagChips);

  // Only worth offering while there is still nothing to show. A location whose
  // address the customer has since typed has no failure left to retry.
  const canRetry = Boolean(
    hasAddressFailed && onRetryAddress && !isAddressPending && !place.address,
  );

  const items: RowMenuItem[] = [
    { id: "edit", label: "Edit", icon: Pencil, onAction: onEdit },
  ];

  if (canRetry && onRetryAddress) {
    items.push({
      id: "retry",
      label: "Find address again",
      icon: RotateCw,
      onAction: onRetryAddress,
    });
  }

  items.push({
    id: "delete",
    label: "Delete",
    icon: Trash2,
    isDanger: true,
    onAction: onDelete,
  });

  return (
    <tr
      data-selected={isSelected || undefined}
      // The row is the target a pointer expects; the button in the name cell is
      // the one a keyboard reaches. Both call the same thing, so a click that
      // hits the button and bubbles here simply selects the same row twice.
      onClick={onSelect}
      className="group cursor-pointer border-t border-border transition-colors hover:bg-default data-selected:bg-accent-soft"
    >
      <td className="w-8 py-2 pl-2 pr-1 align-middle">
        <PinPreview
          icon={place.icon}
          pinIcons={pinIcons}
          fallbackColor={pinColor}
          size="sm"
          className="shrink-0"
        />
      </td>

      <td className="min-w-0 py-2 pr-3 align-middle">
        <button
          type="button"
          aria-current={isSelected ? "true" : undefined}
          className="block max-w-full truncate rounded text-left text-sm font-medium text-foreground outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
          onClick={onEdit}
        >
          {place.name}
        </button>
      </td>

      <td className="min-w-0 py-2 pr-3 align-middle text-sm text-muted">
        {isAddressPending ? (
          <Skeleton className="h-3.5 w-40 rounded-lg" />
        ) : place.address ? (
          <span className="block truncate" title={place.address}>
            {place.address}
          </span>
        ) : hasAddressFailed ? (
          <span className="block truncate">Couldn&apos;t find an address</span>
        ) : (
          <span className="block truncate tabular-nums">
            {formatCoords(place.lat, place.lng)}
          </span>
        )}
      </td>

      {/*
        Chips, not a comma-joined line, and capped at three.

        A location can wear twenty tags, and twenty in a table cell makes the row
        taller than every other row on the page — so the rest are counted. The
        cell is what the Tags filter above is checked against, which is the only
        reason it needs to be readable at a glance rather than complete.

        The dot is on the first chip alone: a location wears any number of tags
        and its pin can only be one colour, so the dot is the row answering which
        of these the pin on the map is wearing. It is also why the cap keeps the
        *first* three rather than the shortest or the alphabetical three.
      */}
      <td className="py-2 pr-3 align-middle text-sm text-muted">
        {tagChips.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1">
            {tagChips.slice(0, 3).map((chip) => (
              <span
                key={chip.id}
                className="flex max-w-32 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-xs"
              >
                {chip.color && chip.color === pinColor ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: chip.color }}
                  />
                ) : null}
                <span className="truncate">{chip.label}</span>
              </span>
            ))}

            {tagChips.length > 3 ? (
              <span className="text-xs tabular-nums">
                +{tagChips.length - 3}
              </span>
            ) : null}
          </span>
        ) : (
          <span aria-label="No tags">&mdash;</span>
        )}
      </td>

      <td className="py-2 pr-3 align-middle">
        <PlaceStatusFlag
          status={place.geocodeStatus}
          confidence={place.geocodeConfidence}
          variant="chip"
        />
      </td>

      <td className="py-2 pr-3 align-middle">
        <PlaceCompleteness place={place} />
      </td>

      <td className="w-10 py-2 pr-2 align-middle">
        {/* The menu is a control inside a clickable row: without this, opening it
            would also open the edit dialog behind it. */}
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          <RowMenu label={`Actions for ${place.name}`} items={items} />
        </div>
      </td>
    </tr>
  );
}
