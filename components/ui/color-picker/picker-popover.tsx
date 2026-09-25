"use client";

import {
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
} from "@heroui/react";

/**
 * The wheel itself: saturation and brightness, hue, and the hex.
 *
 * Opened by the swatch row's custom swatch (`CustomSwatch`), so every colour
 * in the app is chosen on one picker. Must sit inside a `ColorPicker`, which
 * supplies the colour.
 */
export function PickerPopover({ label }: { label: string }) {
  return (
    <ColorPicker.Popover>
      <ColorArea
        aria-label={`${label} saturation and brightness`}
        className="h-32 max-w-full"
        colorSpace="hsb"
        xChannel="saturation"
        yChannel="brightness"
      >
        <ColorArea.Thumb />
      </ColorArea>

      {/* Hue on its own axis. The area covers saturation and brightness,
          which is two of the three — a wheel without this is a picker that
          can only reach one family of colours. */}
      <ColorSlider
        aria-label={`${label} hue`}
        channel="hue"
        className="px-1"
        colorSpace="hsb"
      >
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>

      {/* And the number, because a brand colour arrives as a hex string from a
          style guide rather than as a place on a wheel. */}
      <ColorField aria-label={`${label} hex`} fullWidth>
        <ColorField.Group variant="secondary">
          <ColorField.Prefix>
            <ColorSwatch size="xs" />
          </ColorField.Prefix>
          <ColorField.Input className="tabular-nums" />
        </ColorField.Group>
      </ColorField>
    </ColorPicker.Popover>
  );
}
