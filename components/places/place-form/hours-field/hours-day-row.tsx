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
 */
export function HoursDayRow({
  label,
  value,
  onChange,
}: {
  label: string;
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
    <div className="grid grid-cols-[4.5rem_auto_1fr] items-center gap-x-2 gap-y-1 sm:grid-cols-[5.5rem_auto_1fr_auto_1fr]">
      <span className="text-sm text-foreground">{label}</span>

      <Switch
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
        <div className="col-span-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:contents">
          <TimeInput
            label={`${label}: opens at`}
            value={value.open}
            onChange={(open) => onChange({ ...value, open })}
          />
          <span aria-hidden="true" className="text-sm text-muted">
            to
          </span>
          <TimeInput
            label={`${label}: closes at`}
            value={value.close}
            onChange={(close) => onChange({ ...value, close })}
          />
        </div>
      ) : (
        <span className="text-sm text-muted sm:col-span-3">Closed</span>
      )}
    </div>
  );
}
