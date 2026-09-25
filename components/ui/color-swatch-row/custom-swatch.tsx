"use client";

import { ColorPicker } from "@heroui/react";
import { Check } from "lucide-react";

import { PickerPopover } from "@/components/ui/color-picker/picker-popover";
import { hexOf, useHsbDraft } from "@/components/ui/color-picker/use-hsb-draft";

/** The hue wheel: the conventional face of "any colour". */
const RAINBOW =
  "conic-gradient(from 90deg, #f43f5e, #f59e0b, #eab308, #10b981, #06b6d4, #3b82f6, #8b5cf6, #d946ef, #f43f5e)";

/**
 * The row's last swatch: any colour at all, behind the wheel in
 * `PickerPopover`.
 *
 * It wears HeroUI's own `color-swatch-picker__*` classes rather than a look of
 * its own, so it is the same size, ring and tick as the five beside it — it
 * cannot be one of their items, because an item is a listbox option and this
 * has to be a popover trigger. The wrapper carries `.color-swatch-picker`
 * because the size and selected rules are scoped under it.
 *
 * A hue wheel until the row's answer is a colour none of the presets is; then
 * it *is* that colour and carries the tick.
 */
export function CustomSwatch({
  label,
  value,
  isPicked,
  fallback,
  onChange,
}: {
  label: string;
  /** A `#rrggbb`, or empty for "not set". Seeds the wheel. */
  value: string;
  isPicked: boolean;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useHsbDraft(value, fallback);

  return (
    <div className="color-swatch-picker shrink-0">
      <ColorPicker
        value={draft}
        onChange={(next) => {
          setDraft(next);
          onChange(hexOf(next));
        }}
      >
        <ColorPicker.Trigger
          aria-label={`Custom ${label.toLowerCase()} colour`}
          className="color-swatch-picker__item shrink-0"
          data-selected={isPicked ? "true" : undefined}
          style={{ ["--color-swatch-current" as string]: isPicked ? value : undefined }}
        >
          <span
            aria-hidden="true"
            className="color-swatch-picker__swatch"
            style={{ background: isPicked ? value : RAINBOW }}
          />
          {isPicked ? (
            <span aria-hidden="true" className="color-swatch-picker__indicator">
              <Check
                strokeWidth={3}
                className="[filter:drop-shadow(0_0_1px_oklch(0%_0_0/0.8))]"
              />
            </span>
          ) : null}
        </ColorPicker.Trigger>

        <PickerPopover label={label} />
      </ColorPicker>
    </div>
  );
}
