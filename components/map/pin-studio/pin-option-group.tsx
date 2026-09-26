"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * One design choice as a segmented control: a label, then every option across
 * the full width.
 *
 * HeroUI's `ToggleButtonGroup` in single-selection mode, so the pressed state,
 * the arrow-key roving focus and the focus ring are the library's. It replaced a
 * row of three pin thumbnails per choice behind carousel arrows, which made
 * three-option questions — circle, square or diamond — look like galleries you
 * had to page through.
 *
 * `preview`, when given, draws a small picture before each option's label — the
 * shape row shows *your* pin as each shape. Rows whose options are plain words
 * (size, ring) leave it out.
 *
 * `isDetached` puts a gap between the buttons, for a row of icon-only options
 * such as the glyph picker, where joined buttons read as one wide bar.
 */
export function PinOptionGroup<T extends string>({
  label,
  value,
  options,
  preview,
  isIconOnly = false,
  isDetached = false,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  preview?: (value: T) => ReactNode;
  /** The label is the button's accessible name only. */
  isIconOnly?: boolean;
  isDetached?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Seen, not read: the group carries the same words as its own name. */}
      <span aria-hidden="true" className="text-sm font-medium">
        {label}
      </span>

      <ToggleButtonGroup
        aria-label={label}
        selectionMode="single"
        disallowEmptySelection
        fullWidth
        isDetached={isDetached}
        size="sm"
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          const option = options.find((entry) => entry.value === next);
          if (option) onChange(option.value);
        }}
        className="flex-wrap"
      >
        {options.map((option) => (
          <ToggleButton
            key={option.value}
            id={option.value}
            isIconOnly={isIconOnly}
            aria-label={isIconOnly ? option.label : undefined}
            className={preview ? "h-12 gap-2" : undefined}
          >
            {preview ? preview(option.value) : null}
            {isIconOnly ? null : option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

