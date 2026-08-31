"use client";

import { PinTile } from "@/components/map/pin-tile";
import { PIN_ICONS, CUSTOM_PIN_PREFIX, type CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * Which pin this location wears.
 *
 * The pin used to be fixed at drop time, with no way back — the only cure for a
 * location dropped as the wrong shape was to delete it and drop another. That was
 * survivable while there were six pins nobody had chosen deliberately; it stops
 * being survivable the moment a customer builds a pin of their own, because
 * otherwise it can only ever go on locations they add *after* making it.
 *
 * Every pin the map has, in one scrolling row, with the plain one first. No
 * dropdown: a pin is a picture, and a list of names would make the user read
 * "Landmark" and imagine it.
 *
 * The tiles do not drag here. There is a map directly above this row, and it
 * redraws its marker the moment a tile is pressed — so the picker already has
 * the feedback a drag would have carried, without the gesture.
 */
export function PinField({
  value,
  pinIcons,
  onChange,
}: {
  value: string;
  pinIcons: CustomPinIcon[];
  onChange: (icon: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium">Pin</span>

      {/* Scrolls rather than wraps: with eight custom pins on top of six built-in
          ones, a wrapping grid would push the rest of the form off a phone.

          `px-1` keeps a focused tile's ring off the scroller's own clip edge. It
          used to be paired with `-mx-1` to pull the row back flush with the
          fields above — which made this element 8px wider than its parent, and in
          a two-column grid cell that bled out of the dialog as a horizontal
          scrollbar. Four pixels of flushness is not worth a scrolling form
          (CLAUDE.md §8). */}
      <div className="flex gap-1 overflow-x-auto px-1 pb-1">
        <PinTile
          icon=""
          label="Plain"
          pinIcons={pinIcons}
          isArmed={value === ""}
          onPress={() => onChange("")}
        />

        {pinIcons.map((pin) => {
          const icon = `${CUSTOM_PIN_PREFIX}${pin.id}`;

          return (
            <PinTile
              key={pin.id}
              icon={icon}
              pinIcons={pinIcons}
              isArmed={value === icon}
              onPress={() => onChange(icon)}
            />
          );
        })}

        {PIN_ICONS.map((icon) => (
          <PinTile
            key={icon.id}
            icon={icon.id}
            pinIcons={pinIcons}
            isArmed={value === icon.id}
            onPress={() => onChange(icon.id)}
          />
        ))}
      </div>
    </div>
  );
}
