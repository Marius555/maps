"use client";

import { Button, Popover } from "@heroui/react";
import { Plus } from "lucide-react";

import type { CardSlot as CardSlotDescriptor } from "@/lib/card/card-slots";
import type { AppMap, Place } from "@/lib/repositories/types";
import { slotLabel, slotTitle } from "./slot-labels";
import { SlotForm } from "./slot-form";

/**
 * The dashed box with a `+` in it, drawn where a block's content would be.
 *
 * **It is the block's own box, not something laid over it.** `CardView` swaps
 * this in for `CardBlockContent` (see `renderSlot`), so it inherits the block's
 * width, height, padding, margins and place in the line without knowing any of
 * them — which is what makes filling one in move nothing else on the card. An
 * overlay would have had to re-derive all of that and would have drifted the
 * first time somebody dragged a resize handle in the studio.
 *
 * A HeroUI `Button` rather than a plain `<button>`, because `Popover.Root`
 * wraps React Aria's `DialogTrigger` and its trigger has to be a pressable that
 * reads the trigger context — a bare element gets no `aria-expanded`, no
 * `triggerRef` and no focus restoration on close. Its own ground, padding and
 * height are overridden by `.card-slot` in app/globals.css, which is unlayered
 * and so beats both Tailwind's utilities and @heroui/styles.
 *
 * **The popover, not an in-place editor.** Two of these ask for seven rows of
 * opening times and a photo gallery, and the block they are drawn in is
 * routinely a single 24px line; and every block on the card is inside
 * `overflow-hidden`, with the middle zone a scroller. A portalled dialog is the
 * only thing that fits. What it costs is one guard in `PlaceCard`: the card is
 * moved by a transform at 60fps, so an open slot closes when the map starts
 * moving rather than sliding out from under its own block.
 */
export function CardSlot({
  map,
  place,
  slot,
  isOpen,
  onOpenChange,
}: {
  map: AppMap;
  place: Place;
  slot: CardSlotDescriptor;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const title = slotTitle(slot);

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button
        variant="tertiary"
        aria-label={title}
        /*
         * Our own open flag, and it has to be ours: HeroUI's `Button` reaches
         * React Aria through a `Pressable` wrapper, which forwards the press but
         * leaves `aria-expanded` at whatever it rendered with — measured as
         * `false` on a trigger whose popover was open. So the stylesheet keys
         * off this instead, and the block the popover is about stays marked
         * while it is being filled in.
         */
        data-open={isOpen || undefined}
        className="card-slot"
      >
        <Plus aria-hidden="true" className="size-4" />
        {/* The icon is the whole control, so the words live here — a row of
            identical `+` boxes is unreadable without them, and "Add" alone
            would announce five slots the same way. */}
        <span className="sr-only">Add {slotLabel(slot)}</span>
      </Button>

      {/*
        Beside the card rather than over it: the card is 320px of the owner's own
        design and the point of the slot is that they can see where the thing
        they are adding will land. `end` and not `right`, so it is the writing
        direction's far side; `top` so a tall form — the week, the gallery —
        grows downward from the block it belongs to rather than centring itself
        across the whole card. React Aria flips it when there is no room, which
        is what a card sitting near the right edge of the map needs.
      */}
      <Popover.Content placement="end top">
        <Popover.Dialog aria-label={title}>
          <SlotForm
            map={map}
            place={place}
            slot={slot}
            onDone={() => onOpenChange(false)}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
