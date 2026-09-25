"use client";

import { Description, FieldError, Fieldset } from "@heroui/react";

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
 * **Two columns when the box it sits in is wide enough** — Monday to Thursday,
 * then Friday to Sunday — so a fully open week is four rows tall rather than
 * seven. `grid-flow-col` fills down the first column before the second, which is
 * what keeps the DOM, the tab order and the screen reader in Monday-to-Sunday
 * order while the eye reads the week as two short columns. It is a *container*
 * query: the place form's body is an `@container`, and the card's hours slot is
 * not, so the slot stays one column without being told.
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
    <Fieldset className="gap-2">
      {/* Hidden: every place this is drawn already titles it — the fold says
          "Opening hours", and so does the card slot's own header. */}
      <Fieldset.Legend className="sr-only">Opening hours</Fieldset.Legend>

      <div className="grid gap-x-4 gap-y-2 @lg:grid-flow-col @lg:grid-cols-2 @lg:grid-rows-4">
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

      <Description>
        Press a day to open or close it. Times are the location&rsquo;s own.
      </Description>

      {error ? <FieldError>{error}</FieldError> : null}
    </Fieldset>
  );
}
