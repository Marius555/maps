"use client";

import { FieldError, Label } from "@heroui/react";

import {
  DAY_LABELS,
  DAY_LABELS_SHORT,
  emptyHours,
  type DayHours,
  type OpeningHours,
} from "@/packages/shared/hours";
import { HoursDayRow } from "./hours-day-row";

/**
 * Opening hours for one location: seven rows, Monday first.
 *
 * There was a "Copy to every day" button beside the legend, on the argument that
 * most of the 40–500 locations this product is for keep the same weekday hours
 * and fourteen time entries per location is enough friction to leave the field
 * empty. It was removed on request. Worth knowing what went with it: it appeared
 * only once a first day was filled in, so it moved the legend row as you typed,
 * and it overwrote all seven days including the ones already set — a single
 * press that silently discarded a Sunday somebody had just entered, with no
 * undo. Copying a row at a time is the shape to reach for if it comes back.
 */
export function HoursField({
  value,
  error,
  onChange,
}: {
  value: OpeningHours | null;
  error?: string;
  onChange: (value: OpeningHours) => void;
}) {
  const hours = value ?? emptyHours();

  const setDay = (index: number, day: DayHours) => {
    const next = [...hours];
    next[index] = day;
    onChange(next);
  };

  return (
    <fieldset className="space-y-2">
      <Label elementType="legend">Opening hours</Label>

      <div className="space-y-1">
        {DAY_LABELS.map((label, index) => (
          <HoursDayRow
            key={label}
            label={label}
            shortLabel={DAY_LABELS_SHORT[index]}
            value={hours[index]}
            onChange={(day) => setDay(index, day)}
          />
        ))}
      </div>

      <p className="text-xs text-muted">
        Times are the location&rsquo;s own. Leave a day switched off to show it as
        closed.
      </p>

      {error ? <FieldError>{error}</FieldError> : null}
    </fieldset>
  );
}
