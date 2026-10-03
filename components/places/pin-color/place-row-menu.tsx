"use client";

import { Palette } from "lucide-react";
import { useRef, useState, type HTMLAttributes } from "react";

import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import type { Place } from "@/lib/repositories/types";
import { resolvePin, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinColorPopover } from "./pin-color-popover";

/** What a row needs to offer Pin colour; absent and the row offers nothing. */
export type PinColorMenu = {
  mapId: string;
  /** What the pin wears with no colour of its own — see `pinThemeColor`. */
  themeColor: string;
  /** Whether that is a group's colour, which names the first swatch. */
  isGrouped: boolean;
};

/**
 * A location row's ⋯ menu, with Pin colour in it and the picker it opens.
 *
 * Shared by every row that stands for a location — the editor sidebar's, a
 * route stop's, the Locations page's — so they cannot drift on what the first
 * swatch is or how the colour is saved. Pin colour goes straight after the
 * row's Edit entry: both are about the location itself, and what follows is
 * about its place in the list.
 *
 * The box around the menu button is the picker's anchor, since the menu item
 * that opened it is unmounted by then. The popover renders *inside* that box in
 * the React tree, so the box's own guards — the drag source's `data-no-drag`,
 * the table row's `stopPropagation` — cover presses in the picker too: React
 * bubbles a portal's events through the tree it was rendered in.
 */
export function PlaceRowMenu({
  label,
  items,
  place,
  pinIcons,
  pinColorMenu,
  ...boxProps
}: {
  label: string;
  items: RowMenuItem[];
  /** Undefined for a row with no location behind it — a waypoint. */
  place: Place | undefined;
  pinIcons: readonly CustomPinIcon[];
  pinColorMenu: PinColorMenu | undefined;
} & HTMLAttributes<HTMLDivElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const offered = place && pinColorMenu ? { place, menu: pinColorMenu } : null;
  const all = offered ? withPinColor(items, () => setIsOpen(true)) : items;

  return (
    <div ref={anchorRef} {...boxProps}>
      <RowMenu label={label} items={all} />

      {offered && isOpen ? (
        <PinColorPopover
          mapId={offered.menu.mapId}
          placeId={offered.place.id}
          placeName={offered.place.name}
          color={offered.place.color}
          themeColor={offered.menu.themeColor}
          isGrouped={offered.menu.isGrouped}
          hasPinColor={Boolean(resolvePin(offered.place.icon, pinIcons)?.color)}
          anchorRef={anchorRef}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </div>
  );
}

function withPinColor(items: RowMenuItem[], open: () => void): RowMenuItem[] {
  const item: RowMenuItem = {
    id: "pin-color",
    label: "Pin colour",
    icon: Palette,
    onAction: open,
  };
  const edit = items.findIndex((entry) => entry.id === "edit");

  return [...items.slice(0, edit + 1), item, ...items.slice(edit + 1)];
}
