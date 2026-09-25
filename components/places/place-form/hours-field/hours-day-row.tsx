"use client";

import { ToggleButton } from "@heroui/react";
import { useEffect, useRef } from "react";

import type { DayHours } from "@/packages/shared/hours";
import { HoursRangeField } from "./hours-range-field";

/** What a day gets when it is opened with nothing filled in before. */
const DEFAULT_DAY = { open: "09:00", close: "17:00" };

/**
 * One day of the week: the day's name is the switch, the hours are one field.
 *
 * Closed is the absence of hours, not a third state alongside them, so closing a
 * day writes `null` rather than blanking two strings — that is the shape the
 * storage, the card and the embed all agree on, and it keeps "closed" from being
 * spelled two different ways.
 *
 * The cost of `null` is that closing a day throws its times away. The last open
 * value is therefore kept in a ref, so closing a day to check something and
 * opening it again returns what was typed rather than resetting to 09:00.
 *
 * **The row is the same height open or closed.** It used to be a `Switch`, a
 * short "Closed" line, and two 32px time fields that replaced the line when the
 * switch went on — so every day switched on grew its row and walked everything
 * under it down the dialog. Now the toggle is the day's name itself (a HeroUI
 * `ToggleButton`, pressed = open), and the other half is always a field-sized
 * box: the hours when open, a dashed "Closed" placeholder of identical height
 * when not. Toggling changes what is in the box and nothing else.
 */
export function HoursDayRow({
  label,
  shortLabel,
  value,
  onChange,
}: {
  /** The full name — for the accessibility tree, not for the row. */
  label: string;
  /** "Mon". What the row actually shows. */
  shortLabel: string;
  value: DayHours;
  onChange: (value: DayHours) => void;
}) {
  const isOpen = value !== null;
  const lastOpen = useRef(value ?? DEFAULT_DAY);

  // Written in an effect, not during render — a ref is not render output.
  useEffect(() => {
    if (value) lastOpen.current = value;
  }, [value]);

  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
      {/* `h-9` beats the small size's `md:h-8` (HeroUI's rules sit in
          `layer(components)`, Tailwind's utilities after it), so the toggle and
          the field beside it are one height at every width. `rounded-field`
          rather than the pill it ships with, for the same reason: it sits in a
          column of fields, and should look like one of them. */}
      <ToggleButton
        size="sm"
        isSelected={isOpen}
        aria-label={`${label}: open`}
        onChange={(selected) => onChange(selected ? lastOpen.current : null)}
        className="h-9 w-full rounded-field px-0"
      >
        {shortLabel}
      </ToggleButton>

      {value ? (
        <HoursRangeField label={label} value={value} onChange={onChange} />
      ) : (
        <span className="flex h-9 items-center rounded-field border border-dashed border-border px-3 text-sm text-muted">
          Closed
        </span>
      )}
    </div>
  );
}
