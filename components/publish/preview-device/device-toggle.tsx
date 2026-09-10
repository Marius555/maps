"use client";

import { ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";

import { DEVICES, type DeviceId } from "./devices";

/**
 * Desktop / tablet / phone, as one row of icon tiles.
 *
 * **It sits in the design column's header, and it used to float on the map.**
 * The argument for floating was that this is not a property of the map — nothing
 * it does is published — and that a 20rem column already holding a truncating
 * map name and a Reset had no room for three more tiles. The second half was
 * true and is what changed: the header's back link is an icon now, so the name
 * that was eating the row is gone and the middle of that row is exactly the
 * space three tiles need.
 *
 * The first half still stands, and the header is where it lands rather than in
 * `PropertyFolds` below it for that reason: the folds are what a visitor gets,
 * the header is what the owner is doing. Beside Reset — the other control up
 * there that changes the page rather than the map — is the honest place for it.
 *
 * What that trades away is a control near the thing it resizes. What it buys is
 * the map back: no pill over the bottom of a preview whose whole job is to be
 * looked at, and no 32px box sitting on the results list at the widths where the
 * list is stacked under the map. The old placement notes are worth keeping for
 * the next person who wonders why it was not simply put top-centre — every
 * corner is spoken for by something the owner arranged, and the top middle is
 * covered by the embed's own toolbar under 480px, which is the one width the
 * phone tile exists to check.
 *
 * No ground of its own: in the header it is on the surface every other control
 * up there is on, and the translucent pill it used to wear only existed to lift
 * it off the map.
 *
 * Icon-only with the word in a tooltip and in `sr-only` text, which is
 * `PropertyToggles`' pattern; this is single-select, so it is
 * `PropertyChoice`'s `disallowEmptySelection` on top of it.
 */
export function DeviceToggle({
  value,
  onChange,
}: {
  value: DeviceId;
  onChange: (value: DeviceId) => void;
}) {
  return (
    <ToggleButtonGroup
      size="sm"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      aria-label="Preview width"
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next !== undefined) onChange(String(next) as DeviceId);
      }}
    >
      {DEVICES.map((device, index) => (
        <Tooltip key={device.value} delay={0}>
          <ToggleButton id={device.value} className="min-w-0">
            {/* Every button but the first draws the rule to its left; the
                group owns the radii, so this is all a divider takes. */}
            {index > 0 ? <ToggleButtonGroup.Separator /> : null}
            <device.icon aria-hidden="true" className="size-4" />
            <span className="sr-only">{device.label}</span>
          </ToggleButton>
          <Tooltip.Content placement="bottom">{device.label}</Tooltip.Content>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
