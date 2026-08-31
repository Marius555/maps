"use client";

import { Button, FieldError, Label } from "@heroui/react";

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
 * "Copy to every day" earns its place. Most of the 40–500 locations this product
 * is for keep the same weekday hours, and without it the common case is fourteen
 * time entries per location — enough friction that people would leave the field
 * empty instead, which is the outcome that makes the published map worse.
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
  const firstOpen = hours.find((day): day is NonNullable<DayHours> => day !== null);

  const setDay = (index: number, day: DayHours) => {
    const next = [...hours];
    next[index] = day;
    onChange(next);
  };

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label elementType="legend">Opening hours</Label>

        {firstOpen ? (
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => onChange(hours.map(() => ({ ...firstOpen })))}
          >
            Copy to every day
          </Button>
        ) : null}
      </div>

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
