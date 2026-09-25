"use client";

import { TimeField, type TimeValue } from "@heroui/react";
import { parseTime } from "@internationalized/date";

import { isValidTime, type DayHours } from "@/packages/shared/hours";
import { TimeSlotPopover } from "./time-slot-popover";

type Open = NonNullable<DayHours>;

/**
 * One day's hours as one field: `🕘 09:00 – 17:00`.
 *
 * These were two fields with a clock each, so a row was two boxes and a dash
 * and seven rows were fourteen boxes. HeroUI's `TimeField.Group` is the bordered
 * box a field draws — the same `.date-input-group` its `DateRangePicker` puts a
 * start and an end inside — so this is one group holding two `TimeField`s' inputs,
 * each still its own React Aria field with its own accessible name.
 *
 * The group is outside both fields rather than owned by either, which is what
 * lets it hold two; React Aria's `DateInput` finds its field through context,
 * not through the group, so each input still talks to the right one.
 *
 * `hourCycle={24}` rather than the visitor's locale. The card and the embed both
 * render a day through `formatDay`, which is 24-hour and always has been, so a
 * 12-hour field would be the one place in the product that disagrees with what
 * the published map shows.
 */
export function HoursRangeField({
  label,
  value,
  onChange,
}: {
  /** The full day name, for the accessibility tree. */
  label: string;
  value: Open;
  onChange: (value: Open) => void;
}) {
  return (
    <TimeField.Group fullWidth className="min-w-0">
      {/*
        **`pointer-events-auto` is what makes the clock clickable, and it is not
        optional.** HeroUI treats a prefix as decoration:
        `.date-input-group__prefix` ships `pointer-events: none`, lifted only
        under a `.date-picker` or `.date-range-picker` ancestor. Without this the
        clock renders, looks right, and does nothing when pressed — no type
        error, no console warning. Do not remove it as tidy-up.
      */}
      <TimeField.Prefix className="pointer-events-auto ms-1 me-0">
        <TimeSlotPopover label={label} value={value} onChange={onChange} />
      </TimeField.Prefix>

      <TimeHalf
        label={`${label}: opens at`}
        value={value.open}
        onChange={(open) => onChange({ ...value, open })}
      />
      <span aria-hidden="true" className="px-1 text-sm text-muted">
        &ndash;
      </span>
      <TimeHalf
        label={`${label}: closes at`}
        value={value.close}
        onChange={(close) => onChange({ ...value, close })}
      />
    </TimeField.Group>
  );
}

function TimeHalf({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TimeField
      aria-label={label}
      hourCycle={24}
      // Guarded rather than parsed blind: `parseTime` throws, and a row written
      // by an older build or hand-edited in the console must degrade to an empty
      // field the way `parseHours` degrades to a closed day.
      value={isValidTime(value) ? parseTime(value) : null}
      // `null` arrives while a segment is mid-clear. `DayHours` has no partial
      // state — a day with no hours is a closed day — so the last valid value
      // stands until the user finishes typing the next one.
      onChange={(time) => {
        if (time) onChange(format(time));
      }}
    >
      <TimeField.Input className="flex-none px-1 py-0 tabular-nums">
        {(segment) => <TimeField.Segment segment={segment} />}
      </TimeField.Input>
    </TimeField>
  );
}

/**
 * Back to storage's "HH:MM".
 *
 * Not `toString()`: that is "09:00:00", which `TIME_PATTERN` rejects — so the
 * value would round-trip through the form and be dropped by `parseHours` on the
 * way back out, with nothing anywhere reporting a failure.
 */
function format(time: TimeValue): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
