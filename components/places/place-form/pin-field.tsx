"use client";

import { Header, Label, ListBox, Select } from "@heroui/react";

import { PinPreview } from "@/components/map/pin-preview";
import { pinLabel } from "@/components/map/pin-tile";
import {
  CUSTOM_PIN_PREFIX,
  PIN_ICONS,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * Which pin this location wears.
 *
 * The pin used to be fixed at drop time, with no way back — the only cure for a
 * location dropped as the wrong shape was to delete it and drop another. That was
 * survivable while there were six pins nobody had chosen deliberately; it stops
 * being survivable the moment a customer builds a pin of their own, because
 * otherwise it can only ever go on locations they add *after* making it.
 *
 * **A select, at the height of every other field in the form.** This was a
 * four-up carousel of 56px tiles, which made the one control nobody opens the
 * dialog for the largest thing in it. The argument that kept it a row of
 * pictures was that a list of *names* makes the user read "Landmark" and imagine
 * it — so both the trigger and every row draw the pin itself beside its name,
 * and the map directly above redraws its marker the moment one is picked.
 *
 * The plain pin is stored as `""`, which is not a usable React Aria key — an
 * empty id reads as "nothing selected" — so it travels through the select as
 * `PLAIN` and is turned back into `""` on the way out.
 */

const PLAIN = "plain";

export function PinField({
  value,
  pinIcons,
  onChange,
}: {
  value: string;
  pinIcons: CustomPinIcon[];
  onChange: (icon: string) => void;
}) {
  const builtIn = [PLAIN, ...PIN_ICONS.map((icon) => icon.id)];
  const own = pinIcons.map((pin) => `${CUSTOM_PIN_PREFIX}${pin.id}`);

  const option = (key: string) => {
    const icon = key === PLAIN ? "" : key;

    return (
      <ListBox.Item key={key} id={key} textValue={pinLabel(icon, pinIcons)}>
        <PinOption icon={icon} pinIcons={pinIcons} />
        <ListBox.ItemIndicator />
      </ListBox.Item>
    );
  };

  return (
    <Select
      fullWidth
      value={value === "" ? PLAIN : value}
      onChange={(key) => {
        const next = String(key ?? PLAIN);
        onChange(next === PLAIN ? "" : next);
      }}
    >
      <Label>Pin</Label>
      <Select.Trigger>
        <Select.Value className="min-w-0 overflow-hidden">
          {/* Drawn from the form's value rather than the item's children, so a
              pin that has since been deleted from the studio still shows as
              what the row holds instead of an empty trigger. */}
          <PinOption icon={value} pinIcons={pinIcons} />
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>

      <Select.Popover>
        <ListBox>
          {own.length > 0 ? (
            <ListBox.Section>
              <Header className={HEADER_CLASS}>Your pins</Header>
              {own.map(option)}
            </ListBox.Section>
          ) : null}

          <ListBox.Section>
            <Header className={HEADER_CLASS}>Built-in</Header>
            {builtIn.map(option)}
          </ListBox.Section>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Same heading `InlineSelect` draws over its sections. */
const HEADER_CLASS =
  "px-2 pb-1 pt-2 text-xs font-semibold tracking-wide text-muted uppercase";

/** The picture and the name, in the trigger and in every row. */
function PinOption({
  icon,
  pinIcons,
}: {
  icon: string;
  pinIcons: CustomPinIcon[];
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PinPreview icon={icon} pinIcons={pinIcons} size="sm" className="shrink-0" />
      <span className="truncate">{pinLabel(icon, pinIcons)}</span>
    </span>
  );
}
