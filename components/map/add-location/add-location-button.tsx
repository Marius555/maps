"use client";

import { Button, Popover } from "@heroui/react";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { isAtLimit, type PlanHeadroom } from "@/lib/map/plan-headroom";
import { allPinIcons } from "@/lib/map/pin-pages";
import { PinGrid } from "./pin-grid";
import { useDragToAdd } from "./use-drag-to-add";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * Two ways to add a location, one control.
 *
 * Press it and a grid of pins opens. Drag one of those onto the map and it lands
 * where you let go, wearing that pin — the gesture people already know from every
 * other map they use, and it says what the pin will be before it is one. Press a
 * tile instead and add mode arms with that icon: the cursor becomes a crosshair,
 * and the next click on the map drops that pin and disarms. That path stays
 * because dragging is a pointer gesture and a map builder has to be usable from
 * the keyboard (§8).
 *
 * It used to stay armed until Esc, so that forty pins were one choice and forty
 * clicks. See `onMapClick` in map-editor.tsx for why one pin per arming is the
 * better trade.
 *
 * This is the only pin control on the toolbar. There was a second one beside it
 * holding the full set, back when this one held four slots; the grid holds both
 * now, and see pin-grid.tsx for why that is one question rather than two.
 *
 * The button itself is still a drag source carrying a plain pin, so the gesture
 * that existed before this menu did keeps working unchanged. It is no longer the
 * only route to one, though — the grid's first cell is the same pin, reachable
 * without knowing the button could be dragged at all.
 *
 * The two cannot both fire from one press, hence `consumeDidDrag` — React Aria
 * raises its press on pointer-up regardless of how far the pointer travelled, so
 * without it every drag would also open the menu on the way out. The guard lives
 * in `onOpenChange` rather than in a press handler because that is now the only
 * thing a press does here: the flag is read-clears, and two consumers of it would
 * leave one reading false.
 *
 * **At the plan's location limit this button still opens, and that is the whole
 * design.** The pins inside go grey and a line under them says why (see
 * PinGrid). Disabling the control itself would put the only explanation behind
 * the state it explains, which is the mistake this greying was reverted for once
 * before — lib/query/plan-limit-toast.ts has the history.
 *
 * Its own drag has to be withheld separately, though, and that is easy to miss:
 * this button is a drag source in its own right, carrying a plain pin from the
 * wrapper span below, and it is *not* one of the grid's tiles. Greying the grid
 * alone would leave the oldest route to a new location wide open at the limit.
 */
export function AddLocationButton({
  isAdding,
  addIcon,
  recentIcons,
  pinIcons,
  isBusy,
  headroom,
  onPickIcon,
  onStopAdding,
  onDropPin,
  onDraggingChange,
  onOpenStudio,
}: {
  isAdding: boolean;
  /** The icon add mode is armed with. */
  addIcon: string;
  /** The pins that earn a place on page one — see lib/map/recent-pins.ts. */
  recentIcons: string[];
  /** The map's own pins, for drawing a `custom:` id in the grid and the ghost. */
  pinIcons: CustomPinIcon[];
  isBusy: boolean;
  /** The location allowance, for greying the grid — see PinGrid. */
  headroom?: PlanHeadroom;
  onPickIcon: (icon: string) => void;
  onStopAdding: () => void;
  onDropPin: (clientX: number, clientY: number, icon: string) => void;
  /** Lets the map say what to do with the pin now in the air. */
  onDraggingChange?: (isDragging: boolean) => void;
  onOpenStudio: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [page, setPage] = useState(0);

  const icons = useMemo(
    () => allPinIcons(pinIcons, recentIcons),
    [pinIcons, recentIcons],
  );

  const isFull = headroom ? isAtLimit(headroom) : false;

  const { isDragging, dragProps, consumeDidDrag } = useDragToAdd({
    onDrop: onDropPin,
    // A pin in the air needs the map underneath it, not a menu. The drag itself
    // survives the close: its listeners are on the window, not on the tile.
    onDragStart: () => setIsMenuOpen(false),
    pinIcons,
  });

  // Twice a gesture, not per pointer sample — the position never comes through
  // here, only whether a drag is happening at all.
  useEffect(() => {
    onDraggingChange?.(isDragging);
  }, [isDragging, onDraggingChange]);

  return (
    <Popover.Root
      isOpen={isMenuOpen}
      onOpenChange={(open) => {
        // The press that ended a drag is not a press on the control.
        if (open && consumeDidDrag()) return;
        // While add mode is armed the button is a stop button, not a menu.
        if (open && isAdding) {
          onStopAdding();
          return;
        }

        // Reopening on page three, having forgotten there were three, is the one
        // way paging can leave someone unable to find a pin they can see exists.
        if (open) setPage(0);

        setIsMenuOpen(open);
      }}
    >
      {/*
       * The pointer listeners sit on a wrapper rather than on the Button. React
       * Aria owns the Button's own pointer handling, and adding a second set of
       * handlers to the same element is how the two end up fighting over which
       * of them saw the press.
       *
       * The pin that follows the pointer is not rendered here: it is a plain DOM
       * node the hook appends to the body for the length of the gesture, because
       * it moves with every pointer sample and React does not need to know.
       *
       * It drags a *plain* pin, not the armed icon, because the button draws a
       * plain pin — what you drag should be what you can see you are dragging.
       * The grid is where a shaped pin comes from.
       *
       * Withheld at the plan limit, matching the grid's tiles: there is nowhere
       * for the pin to land, and carrying one across the map to be refused is
       * the gesture this greying exists to stop.
       */}
      <span {...(isFull ? {} : dragProps(""))} className="inline-flex">
        <Button
          size="sm"
          variant={isAdding ? "primary" : "tertiary"}
          aria-pressed={isAdding}
          isPending={isBusy}
          // The dragging half is left to `body.is-pin-dragging`, which paints
          // the arrow over the whole page rather than over this one button.
          className="cursor-pointer"
        >
          {/* Faded, not hidden: the icon is in the air, and what stays behind
              reads as the socket it came out of rather than as a second pin. */}
          <MapPin
            aria-hidden="true"
            className={`size-4 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out-fluid)] ${
              isDragging ? "opacity-30" : "opacity-100"
            }`}
          />

          {/*
           * The label folds away for two independent reasons, and both leave the
           * control as the pin icon alone.
           *
           * A pin being dragged: the control becomes the icon that is now
           * travelling, and it comes back on release. A plain press never
           * collapses it, which is what keeps "Stop adding" readable for anyone
           * using the sticky add mode instead of the gesture.
           *
           * The toolbar's search being open: the two cannot both have the width
           * on a narrow map, and a search you asked for beats a label you have
           * already read. That one is a CSS `group-has-`, watching the
           * `data-search-open` the search puts on itself — a boolean threaded
           * from a sibling, through the toolbar, and back down here would be
           * three components knowing about one, to say what the cascade already
           * knows.
           *
           * `max-width`, not `width` — it animates reliably from an auto-sized
           * flex child, the same idiom the nav sidebar's labels use. The text
           * stays in the DOM throughout, so the button keeps its accessible name.
           *
           * The negative margin cancels the Button's own `gap-2`. Without it the
           * label reaches zero width and leaves half a centimetre of nothing
           * behind, and the button stops short of closing up.
           */}
          
        </Button>
      </span>

      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Choose a pin">
          <PinGrid
            page={page}
            icons={icons}
            pinIcons={pinIcons}
            armedIcon={addIcon}
            isAdding={isAdding}
            headroom={headroom}
            dragProps={dragProps}
            onPageChange={setPage}
            onPick={(icon) => {
              setIsMenuOpen(false);
              onPickIcon(icon);
            }}
            onOpenStudio={() => {
              // The studio owns the screen from here: a popover still hanging off
              // the toolbar behind a modal is a second dialog nobody dismissed.
              setIsMenuOpen(false);
              onOpenStudio();
            }}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
