"use client";

import { PinTile } from "@/components/map/pin-tile";
import { CarouselTrack } from "@/components/ui/carousel";
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
 * Every pin the map has, in one row, with the plain one first. No dropdown: a pin
 * is a picture, and a list of names would make the user read "Landmark" and
 * imagine it.
 *
 * **Paged by arrows rather than by a scrollbar**, which is `CarouselTrack` — the
 * same control the pin studio's library and its field rows already use. A native
 * horizontal scrollbar under a row of pictures reads as a rendering accident
 * rather than as a control, and it is the one part of this dialog somebody has to
 * discover by dragging. The arrows sit *beside* the track and never over a tile:
 * on a four-up row an overlaid chevron covers a quarter of what is being looked
 * at. That, and the reserved-but-invisible slot for a row short enough not to
 * need them, are both argued in the component itself.
 *
 * `size="lg"` because the track gives every tile a quarter of the row, and a 36px
 * pin adrift in that much space reads as a mistake. `as="div"` with a `role`
 * of `group`: these are `aria-pressed` buttons, and a list of controls is not a
 * list — the same call `PinFieldRow` makes.
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
    <div role="group" aria-label="Pin" className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium">Pin</span>

      {/* The plain pin, then the map's own, then the built-ins — `count` is what
          tells the track to re-measure when a customer adds or deletes one in the
          studio, since it cannot derive that from `children`. */}
      <CarouselTrack
        label="Pin"
        count={1 + pinIcons.length + PIN_ICONS.length}
        columns={4}
        as="div"
      >
        <PinTile
          icon=""
          label="Plain"
          pinIcons={pinIcons}
          size="lg"
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
              size="lg"
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
            size="lg"
            isArmed={value === icon.id}
            onPress={() => onChange(icon.id)}
          />
        ))}
      </CarouselTrack>
    </div>
  );
}
