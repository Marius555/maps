"use client";

import { Switch } from "@heroui/react";
import { useEffect, useRef } from "react";

import type { DayHours } from "@/packages/shared/hours";
import { TimeInput } from "./time-input";

/** What a day gets when it is switched on with nothing filled in before. */
const DEFAULT_DAY = { open: "09:00", close: "17:00" };

/**
 * One day of the week.
 *
 * Closed is the absence of hours, not a third state alongside them, so the switch
 * writes `null` rather than blanking two strings — that is the shape the storage,
 * the card and the embed all agree on, and it keeps "closed" from being spelled
 * two different ways.
 *
 * The cost of `null` is that switching a day off throws its times away. The last
 * open value is therefore kept in a ref, so toggling a day off to check something
 * and back on again returns what was typed rather than resetting to 09:00.
 *
 * **One layout at every width, and it is the narrow one.** This had a five-column
 * `sm:` variant with full day names and a `to` between the boxes, which does not
 * fit: `sm:` is a *viewport* query, so it applied inside a 448px dialog on every
 * desktop and ran the row off the edge of the fold. So "Mon" rather than
 * "Monday", a small switch, an en dash for the word, and the full name kept where
 * it is actually needed — in the switch's own label and on each time field, which
 * is what a screen reader reads and what "Wednesday" was never doing visually
 * beside a box saying 09:00.
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

  /*
   * The two time fields share the row's slack, which is what the `1fr` columns
   * are for. They were briefly `auto` with a spacer soaking up the leftover —
   * back when a field was digits alone and stretching one only made a wide box
   * around a narrow number. Each carries a clock now, so the width has something
   * in it.
   */
  return (
    <div className="grid grid-cols-[2.5rem_auto_1fr_auto_1fr] items-center gap-x-1.5">
      <span className="text-xs text-foreground">{shortLabel}</span>

      <Switch
        size="sm"
        isSelected={isOpen}
        onChange={(selected) => onChange(selected ? lastOpen.current : null)}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="sr-only">{`${label}: open`}</span>
        </Switch.Content>
      </Switch>

      {value ? (
        <>
          <TimeInput
            label={`${label}: opens at`}
            value={value.open}
            onChange={(open) => onChange({ ...value, open })}
          />
          <span aria-hidden="true" className="text-xs text-muted">
            &ndash;
          </span>
          <TimeInput
            label={`${label}: closes at`}
            value={value.close}
            onChange={(close) => onChange({ ...value, close })}
          />
        </>
      ) : (
        <span className="col-span-3 text-xs text-muted">Closed</span>
      )}
    </div>
  );
}
