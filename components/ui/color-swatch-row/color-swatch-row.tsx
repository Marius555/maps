"use client";

import { ColorSwatchPicker, Label } from "@heroui/react";

import { CustomSwatch } from "./custom-swatch";

/**
 * Zero alpha: how "not set" is spelled inside the picker. HeroUI's swatch draws
 * its own checkerboard for it, which is the conventional "no colour" mark.
 * The `transparent` keyword would throw in `parseColor`.
 */
const UNSET = "#00000000";

/**
 * What the row's first swatch is, when it has one.
 *
 * `default` is "not set", and `name` says what that means for this field —
 * "Theme default", "No border", "Automatic". `color` is a real colour that is
 * also what the field resolves to when nothing is stored (the accent's orange);
 * pressing it emits whatever `emit` says, so a caller can clear the key rather
 * than store a value equal to the default.
 *
 * No leading swatch at all is for a colour that is required — a tag, a shape,
 * a pin's fill — where "not set" is not an answer.
 */
export type LeadingSwatch =
  | { kind: "default"; name?: string }
  | { kind: "color"; color: string; name: string; emit: string | undefined };

/** Whether the colour came from a swatch press or from dragging the wheel. */
export type SwatchSource = "preset" | "custom";

/**
 * One colour choice as a single line of six: the field's own answer (or a
 * fifth preset), four presets, and a custom swatch that opens the wheel.
 *
 * Six because that is what reads as a choice rather than a palette, and it fits
 * every column this app has with room to spare — which matters, because a flex
 * row that runs out of width squeezes each swatch's width and not its height.
 *
 * The first five are HeroUI's own `ColorSwatchPicker`, so the selected ring,
 * the tick and the focus ring are the library's rather than ours; the sixth
 * wears the same classes (see `CustomSwatch`), because a listbox cannot hold a
 * popover trigger.
 */
export function ColorSwatchRow({
  label,
  hideLabel = false,
  value,
  leading,
  presets,
  fallback,
  onChange,
}: {
  label: string;
  /** Keep the name for screen readers only, where the caller labels the row itself. */
  hideLabel?: boolean;
  /** A `#rrggbb`, or empty for "not set". */
  value: string;
  leading?: LeadingSwatch;
  presets: readonly { color: string; name: string }[];
  /** What the wheel opens on when nothing is set. */
  fallback: string;
  onChange: (hex: string | undefined, source: SwatchSource) => void;
}) {
  const current = value.toLowerCase();
  const leadingColor = !leading
    ? undefined
    : leading.kind === "default"
      ? UNSET
      : leading.color;

  // An unset accent *is* the orange, so the orange shows as picked.
  const pickerValue = current || leadingColor || UNSET;
  const isCustom =
    !!current &&
    pickerValue !== leadingColor &&
    !presets.some((preset) => preset.color === pickerValue);

  const items = [
    ...(leading && leadingColor
      ? [
          {
            color: leadingColor,
            name:
              leading.name ??
              (leading.kind === "default" ? "Default (follows the map)" : ""),
          },
        ]
      : []),
    ...presets,
  ];

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {hideLabel ? null : <Label>{label}</Label>}

      <div className="flex flex-nowrap items-center gap-2">
        <ColorSwatchPicker
          aria-label={label}
          className="contents"
          value={pickerValue}
          onChange={(color) => {
            const hex = color.toString("hex").toLowerCase();

            if (color.getChannelValue("alpha") === 0)
              onChange(undefined, "preset");
            else if (leading?.kind === "color" && hex === leading.color)
              onChange(leading.emit, "preset");
            else onChange(hex, "preset");
          }}
        >
          {items.map((item) => (
            <ColorSwatchPicker.Item
              key={item.color}
              color={item.color}
              // Flex items shrink by default, and a squeezed swatch loses width
              // but not height — an egg, not a circle.
              className="shrink-0"
            >
              {/* The item names itself after its swatch. */}
              <ColorSwatchPicker.Swatch colorName={item.name} />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>

        <CustomSwatch
          label={label}
          value={value}
          isPicked={isCustom}
          fallback={fallback}
          onChange={(hex) => onChange(hex, "custom")}
        />
      </div>
    </div>
  );
}
