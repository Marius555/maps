"use client";

import { ChevronLeft, MoreHorizontal, Plus } from "lucide-react";
import { useId } from "react";

import { PinTile, type DragProps } from "@/components/map/pin-tile";
import { PlanLimitNote } from "@/components/map/plan-limit-note";
import { isAtLimit, type PlanHeadroom } from "@/lib/map/plan-headroom";
import { pinPages } from "@/lib/map/pin-pages";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * Every pin this map can drop, four across and two deep, a page at a time.
 *
 * It was two menus. A four-slot row hung off the add control answered "which pin,
 * quickly" — a plain pin, the two most recently used, and the studio — and a
 * separate grid beside it answered "which pin, out of all of them". Two controls a
 * pixel apart, two popovers, two drag hooks and three copies of the same dashed
 * cell, to split a question nobody was asking in two halves. One grid answers both:
 * the pins this map keeps using are ordered onto page one (lib/map/pin-pages.ts),
 * and the rest are behind More.
 *
 * Two ways to use a tile, matching the control it hangs off: drag it onto the map
 * and the pin lands where you let go, or press it and add mode arms with that icon
 * so every click drops another one. The second is also the keyboard route — a map
 * builder has to be usable without a pointer (§8), and a drag gesture never can be.
 *
 * Paging rather than scrolling. A scroll container inside a popover over a map is
 * a wheel event with three plausible owners, and on a trackpad the map wins about
 * half the time. More and Back are two presses that cannot be misread.
 *
 * The last cell is always New, and none of the three navigation cells is a drag
 * source: there is nothing to drag out of "make a new pin" or "show me the rest",
 * and a tile that started a drag which could not end in a marker would be a gesture
 * that silently does nothing. They share one shape, so a cell that is not a pin
 * looks like a cell that is not a pin before you have read the word under it.
 *
 * No instructions above the grid. A tile that is draggable and pressable says so
 * by being under the cursor as a grab handle; a line of prose explaining a
 * direct-manipulation gesture is a sign the gesture is not obvious, not a fix
 * for it.
 *
 * At the plan's location limit every *pin* goes grey and stops responding, while
 * Back, More and New stay live. The split is on what a cell does: a pin drops a
 * location and there is no room for one, but paging through the library and
 * designing a pin in the studio both cost nothing and are the things somebody at
 * the limit is most likely to be doing while they decide what to delete. A pin
 * made in the studio is still saved, and simply cannot be dropped yet.
 */
export function PinGrid({
  page,
  pinIcons,
  icons,
  armedIcon,
  isAdding,
  headroom,
  dragProps,
  onPageChange,
  onPick,
  onOpenStudio,
}: {
  page: number;
  /** The map's own pins, for resolving a `custom:` id to a drawing. */
  pinIcons: CustomPinIcon[];
  /** Every pin to offer, already ordered — see lib/map/pin-pages.ts. */
  icons: string[];
  /** The icon add mode is currently armed with, if it is armed at all. */
  armedIcon: string;
  isAdding: boolean;
  /**
   * The location allowance. Omitted where there is no plan to check against —
   * nothing greys, which is what every caller got before this existed.
   */
  headroom?: PlanHeadroom;
  dragProps: (icon: string) => DragProps;
  onPageChange: (page: number) => void;
  onPick: (icon: string) => void;
  onOpenStudio: () => void;
}) {
  const pages = pinPages(icons);
  // A pin deleted in the studio can shrink the list under the open page.
  const current = Math.min(page, pages.length - 1);
  const shown = pages[current] ?? [];

  const hasBack = current > 0;
  const hasMore = current < pages.length - 1;

  const isFull = headroom ? isAtLimit(headroom) : false;
  // Shared by every disabled tile's `aria-describedby` and the note itself, so
  // the reason is announced with the tile rather than stranded below the grid.
  const noteId = useId();

  return (
    /* `grid-cols-4` literally. Tailwind reads class names, not constants, so
       PIN_MENU_COLUMNS cannot be interpolated here — it says the same 4 to the
       paginator, and the two are noted in each other's files. */
    <div className="grid w-64 grid-cols-4 gap-1">
      {hasBack ? (
        <NavCell
          label="Back"
          icon={ChevronLeft}
          onPress={() => onPageChange(current - 1)}
        />
      ) : null}

      {shown.map((icon) => (
        <PinTile
          key={icon}
          icon={icon}
          label={icon === "" ? "Plain" : undefined}
          pinIcons={pinIcons}
          isArmed={isAdding && armedIcon === icon}
          isDisabled={isFull}
          describedBy={noteId}
          /* Withheld at the limit as well as refused inside the tile. A drag
             that can only end in a rejected create is a gesture that carries a
             pin across the map to say no. */
          dragProps={isFull ? undefined : dragProps(icon)}
          onPress={() => onPick(icon)}
        />
      ))}

      {hasMore ? (
        <NavCell
          label="More"
          icon={MoreHorizontal}
          onPress={() => onPageChange(current + 1)}
        />
      ) : null}

      {/* Last cell on every page, so the way to make a pin is never the thing you
          have to page back to find. */}
      <NavCell
        label="New"
        title="Make a new pin"
        icon={Plus}
        onPress={onOpenStudio}
      />

      {/* Spans the row it sits on rather than living in a wrapper, so the grid
          stays the one thing laying this menu out. */}
      {isFull && headroom ? (
        <div className="col-span-4 pt-1">
          <PlanLimitNote id={noteId} resource="places" headroom={headroom} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A cell that navigates or opens the studio instead of choosing a pin.
 *
 * Plain `<button>` for the same reason the tiles are — see PinTile — and a dashed
 * circle rather than a pin preview, because giving it a fake one to keep the shapes
 * matching would promise a drag it cannot honour.
 *
 * `title` splits from `label` for the one cell where they differ: the caption has a
 * cell four characters wide to live in, and "New" fits where "Make a new pin" says
 * what it does.
 */
function NavCell({
  label,
  title,
  icon: Icon,
  onPress,
}: {
  label: string;
  /** Hover text, when the caption is too short to be the whole sentence. */
  title?: string;
  icon: typeof ChevronLeft;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onPress}
      className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-transparent p-2 text-center transition-colors duration-[var(--duration-fast)] hover:bg-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
    >
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-full border border-dashed border-border text-muted"
      >
        <Icon className="size-4" />
      </span>
      <span className="w-full truncate text-xs leading-tight text-muted">{label}</span>
    </button>
  );
}
