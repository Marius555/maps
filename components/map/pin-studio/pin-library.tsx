"use client";

import { Pencil } from "lucide-react";

import { PinTile } from "@/components/map/pin-tile";
import { Carousel } from "@/components/ui/carousel";
import { MAX_PIN_ICONS } from "@/lib/validation/pin-icon.schema";
import {
  CUSTOM_PIN_PREFIX,
  PIN_ICONS,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * Every pin this map can use, four at a time.
 *
 * The add menu pages through the same pins in eight-cell chunks; this lays them out
 * as two named sets, which is the view that answers "what have I made" rather than
 * "which one am I dropping next".
 *
 * Four across rather than a wrapping grid: at six columns each pin was a 36px
 * thumbnail, and the thing you are choosing should not be the smallest thing on
 * the screen. Rotating to the rest costs a press; failing to tell two pins apart
 * costs a location dropped as the wrong shape.
 *
 * Pressing a pin arms add mode with it and closes the sheet. It does *not* drag:
 * there is a backdrop between here and the map, so a drag out of here could never
 * end in a marker. The add menu's grid is the drag surface, and picking here is
 * what floats a pin to the front of it — which is the loop, not a limitation.
 *
 * Editing hangs off the tile rather than replacing its press, because the common
 * action by far is "use this one" and burying that behind a mode would be
 * backwards.
 */
export function PinLibrary({
  pinIcons,
  usageByPin,
  onPick,
  onEdit,
}: {
  pinIcons: CustomPinIcon[];
  /** Locations per custom pin id, shown so a crowded library can be pruned. */
  usageByPin: Map<string, number>;
  onPick: (icon: string) => void;
  onEdit: (pin: CustomPinIcon) => void;
}) {
  const isFull = pinIcons.length >= MAX_PIN_ICONS;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        {pinIcons.length === 0 ? (
          <>
            <span className="text-sm font-medium">Your pins</span>
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
              Make a pin in your own colours, or with your logo in it, and drop your
              locations as that.
            </p>
          </>
        ) : (
          <Carousel title="Your pins" count={pinIcons.length}>
            {pinIcons.map((pin) => (
              <li key={pin.id} className="relative">
                <PinTile
                  icon={`${CUSTOM_PIN_PREFIX}${pin.id}`}
                  pinIcons={pinIcons}
                  size="lg"
                  onPress={() => onPick(`${CUSTOM_PIN_PREFIX}${pin.id}`)}
                />

                <button
                  type="button"
                  aria-label={`Edit ${pin.label}`}
                  onClick={() => onEdit(pin)}
                  className="absolute end-0 top-0 cursor-pointer rounded-full border border-border bg-surface p-1 text-muted shadow-sm transition-colors duration-[var(--duration-fast)] hover:text-foreground"
                >
                  <Pencil aria-hidden="true" className="size-3" />
                </button>

                {(usageByPin.get(pin.id) ?? 0) > 0 ? (
                  <span className="sr-only">
                    {usageByPin.get(pin.id)} locations use this pin
                  </span>
                ) : null}
              </li>
            ))}
          </Carousel>
        )}

        {isFull ? (
          <p className="text-xs text-muted">
            You&rsquo;ve reached the maximum of {MAX_PIN_ICONS} custom pins. Delete
            one to make another.
          </p>
        ) : null}
      </section>

      <Carousel title="Built in" count={PIN_ICONS.length}>
        {PIN_ICONS.map((icon) => (
          <li key={icon.id}>
            <PinTile
              icon={icon.id}
              pinIcons={pinIcons}
              size="lg"
              onPress={() => onPick(icon.id)}
            />
          </li>
        ))}
      </Carousel>
    </div>
  );
}
