"use client";

import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { pickedTileClass } from "@/components/ui/picked-tile";
import { PinFieldRow } from "./pin-field-row";

/**
 * One colour choice, as the colours themselves.
 *
 * The sibling of PinDesignRow, and the reason it is a separate component rather
 * than one more use of it: that one draws every option as the pin it would make,
 * which is the best possible preview right up until the option *is* the colour.
 * A pin whose ring turned white, previewed on a white dialog, shows you nothing.
 * So a swatch, and the pin in the hero above carries the result.
 *
 * Plain buttons rather than HeroUI's ColorSwatchPicker, which sizes its items
 * itself and stretches a swatch into a pill when it is handed a flexible track.
 * The names come from the palette to make up for the accessible name React Aria
 * would otherwise have derived.
 *
 * `auto` is an option and not an absence, because the two are different pins: a
 * stored colour is that colour in both themes, where "auto" is white on a light
 * map and follows `--accent-foreground` into a dark one. It leads the row because
 * it is what every pin starts as.
 */
export function PinSwatchRow({
  label,
  value,
  colors,
  names,
  autoLabel,
  onChange,
}: {
  label: string;
  /** A hex, or "" for auto. */
  value: string;
  colors: readonly string[];
  names: Record<string, string>;
  /** Adds a leading "no colour of its own" chip storing "". Omit where one is required. */
  autoLabel?: string;
  onChange: (color: string) => void;
}) {
  return (
    <PinFieldRow label={label} count={colors.length + (autoLabel ? 1 : 0)}>
      {autoLabel ? (
        <Swatch
          name={autoLabel}
          isPicked={!value}
          onPress={() => onChange("")}
          // A dashed outline and no fill: the one chip in the row that is not a
          // colour should not look like a colour that failed to load. It says so
          // in words as well, which a 36px circle had no room for.
          className="border-dashed border-muted bg-transparent"
        >
          <span className="text-xs text-muted">{autoLabel}</span>
        </Swatch>
      ) : null}

      {colors.map((color) => (
        <Swatch
          key={color}
          name={names[color] ?? color}
          isPicked={value === color}
          onPress={() => onChange(color)}
          style={{ background: color }}
        />
      ))}
    </PinFieldRow>
  );
}

/**
 * The colour, at the same size as everything else in the dialog.
 *
 * These were 36px circles, small enough that eleven of them were one row. The row
 * fits three of anything now (see PinFieldRow), so a circle would be a dot
 * floating in a 130px box — instead the colour fills its tile as a pill, and the
 * button matches the 56px height of the pin tiles above it so the seven rows line
 * up as one form rather than as a form and a strip of dots.
 *
 * The check goes *inside* the pill, and is the one selection tick left in the
 * builder now that the pin tiles rely on their fill alone. It survives because
 * this is the row where a tinted background says least: every option here is a
 * tint, so "the selected one is shaded" is not a signal that can be read. White
 * with a shadow under it reads on every colour in the palette, including white —
 * the shadow is what makes that true, and is why it is not a plain white tick.
 *
 * A chip with a word in it is the exception and gets no tick: it is not a tint,
 * so the shaded background reads on it, and a tick laid over "Automatic" would
 * cover the only thing that says what the chip is.
 */
function Swatch({
  name,
  isPicked,
  className = "",
  style,
  onPress,
  children,
}: {
  name: string;
  isPicked: boolean;
  className?: string;
  style?: CSSProperties;
  onPress: () => void;
  /** Drawn inside the pill. The "automatic" chip's own word, and nothing else. */
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={isPicked}
      onClick={onPress}
      className={`${pickedTileClass(isPicked)} grid h-14 place-items-center p-1.5`}
    >
      <span
        aria-hidden="true"
        className={`col-start-1 row-start-1 grid h-9 w-full place-items-center rounded-full border border-border ${className}`}
        style={style}
      >
        {children}
      </span>

      {isPicked && !children ? (
        <Check
          aria-hidden="true"
          className="col-start-1 row-start-1 size-4 text-white [filter:drop-shadow(0_0_1px_oklch(0%_0_0/0.9))]"
        />
      ) : null}
    </button>
  );
}
