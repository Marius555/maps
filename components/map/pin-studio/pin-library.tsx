"use client";

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
 * **Pressing a pin opens the editor.** This is where pins are made and changed;
 * the grid hanging off the add control is where they are dropped, and it is the
 * better surface for it anyway — it drags, and there is a backdrop between here
 * and the map so a drag out of this could never end in a marker. Editing used to
 * hang off a pencil badge in the corner of each tile, which put the whole reason
 * to open this dialog behind a target a third the size of the thing it edited.
 * Using a pin is still one press from here: the editor saves and arms in one
 * action.
 *
 * Pressing a built-in makes a *new* pin wearing that glyph rather than editing it
 * in place. Built-ins live in code and are shared by every map on the platform,
 * so there is nothing here to edit — but "this one, in my colours" is the most
 * common thing anyone wants from them, and forking is how you get it. At the cap
 * they stop being a way in and say so, because a press that opens a form you
 * cannot save is worse than a button that is plainly unavailable.
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
              <li key={pin.id}>
                <PinTile
                  icon={`${CUSTOM_PIN_PREFIX}${pin.id}`}
                  pinIcons={pinIcons}
                  size="lg"
                  onPress={() => onEdit(pin)}
                />

                {(usageByPin.get(pin.id) ?? 0) > 0 ? (
                  <span className="sr-only">
                    {usageByPin.get(pin.id)} locations use this pin
                  </span>
                ) : null}
              </li>
            ))}
          </Carousel>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Carousel title="Built in" count={PIN_ICONS.length}>
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
        </Carousel>

        {/* Under the built-ins rather than under your own, which is where it was:
            the cap is the reason *these* are unpressable, and an explanation two
            sections above the thing it explains is one nobody reads. */}
        {isFull ? (
          <p className="text-xs text-muted">
            You&rsquo;ve reached the maximum of {MAX_PIN_ICONS} custom pins. Delete one
            to make another.
          </p>
        ) : null}
      </section>
    </div>
  );
}
