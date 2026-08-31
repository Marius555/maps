"use client";

import type { ReactNode } from "react";

/**
 * The two controls every properties panel is built from.
 *
 * Lifted out of `card-properties.tsx` when the block half and the card half
 * became separate files: they are the same slider and the same segmented row in
 * both, and two copies would drift into two different-looking panels one tab
 * apart.
 */

/**
 * A number with a bar you can drag.
 *
 * A native `input[type=range]`, because it is already keyboard-operable, already
 * announced correctly, and already respects a pointer, a finger and a trackpad.
 * Its `min` and `max` come from the same spec the layout is clamped by, so the
 * control cannot offer a value the save would refuse.
 */
export function PropertySlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted">
          {value} {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-default accent-accent"
      />
    </label>
  );
}

/**
 * One of a handful of named choices, as a row of buttons.
 *
 * A `fieldset` with `aria-pressed` rather than a `select`: there are never more
 * than three options, they are all worth seeing at once, and picking one is a
 * single press instead of a press, a scroll and a second press.
 */
export function PropertyChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-foreground">{label}</legend>
      <div className="flex gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            title={option.label}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
              value === option.value
                ? "border-accent bg-accent-soft text-foreground"
                : "border-border text-muted hover:border-accent"
            }`}
          >
            {option.icon ?? null}
            {/* An icon says it faster and a word says it unambiguously, so the
                word stays for a screen reader when there is an icon to see. */}
            <span className={option.icon ? "sr-only" : undefined}>
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
