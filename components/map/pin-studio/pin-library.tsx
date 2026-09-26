"use client";

import { MapPin } from "lucide-react";

import { PinTile } from "@/components/map/pin-tile";
import { CarouselSection } from "@/components/ui/carousel-section";
import { EmptyState } from "@/components/ui/empty-state";
import { MAX_PIN_ICONS } from "@/lib/validation/pin-icon.schema";
import {
  CUSTOM_PIN_PREFIX,
  PIN_ICONS,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * Every pin this map can use, as two panels of one-line carousels.
 *
 * The add menu pages through the same pins in eight-cell chunks; this lays them out
 * as two named sets, which is the view that answers "what have I made" rather than
 * "which one am I dropping next". Each set is a `CarouselSection` — a panel with
 * its name, what pressing a tile does, and a count — because two bare labels over
 * two bare tracks read as one undivided list.
 *
 * Four across rather than a wrapping grid: at six columns each pin was a 36px
 * thumbnail, and the thing you are choosing should not be the smallest thing on
 * the screen.
 *
 * **Pressing a pin opens the editor.** This is where pins are made and changed;
 * the grid hanging off the add control is where they are dropped, and it is the
 * better surface for it anyway — it drags, and there is a backdrop between here
 * and the map so a drag out of this could never end in a marker. Using a pin is
 * still one press from here: the editor saves and arms in one action.
 *
 * Pressing a built-in makes a *new* pin wearing that glyph rather than editing it
 * in place. Built-ins live in code and are shared by every map on the platform,
 * so there is nothing here to edit — but "this one, in my colours" is the most
 * common thing anyone wants from them, and forking is how you get it. At the cap
 * they stop being a way in and say so.
 *
 * "New pin" itself is the dialog's primary footer button (PinStudio) — where
 * every other dialog keeps the action that moves you forward — rather than a
 * small button squeezed against the heading. The empty state points at it
 * instead of carrying a second copy of the same button.
 */
export function PinLibrary({
  pinIcons,
  usageByPin,
  onEdit,
  onFork,
}: {
  pinIcons: CustomPinIcon[];
  /** Locations per custom pin id, shown so a crowded library can be pruned. */
  usageByPin: Map<string, number>;
  onEdit: (pin: CustomPinIcon) => void;
  /** A built-in glyph id → a new pin already wearing it. */
  onFork: (glyph: string) => void;
}) {
  const isFull = pinIcons.length >= MAX_PIN_ICONS;

  return (
    <div className="flex flex-col gap-3">
      <CarouselSection
        title="Your pins"
        hint="Tap a pin to edit it"
        count={pinIcons.length}
        badge={`${pinIcons.length} of ${MAX_PIN_ICONS}`}
        empty={
          <EmptyState
            size="sm"
            surface={false}
            icon={MapPin}
            title="No pins of your own yet"
            description="Press New pin to make one in your own colours, or with your logo in it."
          />
        }
      >
        {pinIcons.map((pin) => {
          const usage = usageByPin.get(pin.id) ?? 0;

          return (
            <li key={pin.id}>
              <PinTile
                icon={`${CUSTOM_PIN_PREFIX}${pin.id}`}
                pinIcons={pinIcons}
                size="lg"
                onPress={() => onEdit(pin)}
              />

              {usage > 0 ? (
                <span className="sr-only">
                  {usage === 1 ? "1 location uses" : `${usage} locations use`} this pin
                </span>
              ) : null}
            </li>
          );
        })}
      </CarouselSection>

      <CarouselSection
        title="Start from a built-in"
        hint="Tap one to make it in your colours"
        count={PIN_ICONS.length}
        // Under the built-ins rather than under your own: the cap is the reason
        // *these* are unpressable, and an explanation elsewhere goes unread.
        footnote={
          isFull
            ? `You've reached the maximum of ${MAX_PIN_ICONS} custom pins. Delete one to make another.`
            : undefined
        }
      >
        {PIN_ICONS.map((icon) => (
          <li key={icon.id}>
            <PinTile
              icon={icon.id}
              pinIcons={pinIcons}
              size="lg"
              isDisabled={isFull}
              onPress={() => onFork(icon.id)}
            />
          </li>
        ))}
      </CarouselSection>
    </div>
  );
}
