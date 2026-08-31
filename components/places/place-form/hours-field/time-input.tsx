"use client";

import { Button, ListBox, Popover, TimeField, type TimeValue } from "@heroui/react";
import { parseTime } from "@internationalized/date";
import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isValidTime } from "@/packages/shared/hours";
import { nearestSlot, TIME_SLOTS } from "./time-slots";

/**
 * One time: HeroUI's segmented field, plus the clock that picks one from a list.
 *
 * This was a bare `<input type="time">`, whose box, height and clock popover are
 * a different control in every browser engine — fourteen of them in one fold,
 * inside a form where every other field is React Aria's.
 *
 * Replacing it with `TimeField` alone was the overcorrection: it dropped the
 * clock and the popover with the native control, so the only way left to set a
 * time was to type it. **HeroUI v3 ships no TimePicker** — `time-field`,
 * `date-field`, `date-picker` and `calendar`, and nothing between them — so the
 * icon and its list are composed here from HeroUI parts, which is exactly how
 * `DatePicker` is built out of `DateField` + a trigger + a `Popover`.
 *
 * The two halves cover different users rather than duplicating each other: the
 * list is one tap for the half-hours opening hours actually keep, and the
 * segments take 09:37 for the one shop that opens then.
 *
 * `hourCycle={24}` rather than the visitor's locale. The card and the embed both
 * render a day through `formatDay`, which is 24-hour and always has been, so a
 * 12-hour picker would be the one place in the product that disagrees with what
 * the published map shows.
 */
export function TimeInput({
  value,
  label,
  isDisabled,
  onChange,
}: {
  value: string;
  /** Visually hidden — a seven-row grid cannot carry fourteen visible labels. */
  label: string;
  isDisabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  /*
   * Open the list next to the time it is already showing.
   *
   * A popover that opens at 00:00 makes someone setting a 9am opening scroll
   * past eighteen rows to reach it. Done by scrolling rather than by selecting
   * `nearestSlot`, because 09:37 has no slot and ticking 09:30 to make the list
   * move would draw a checkmark beside a time the location does not keep.
   *
   * Deliberately after paint and not in a layout effect: React Aria mounts the
   * popover's content in a portal, so the rows do not exist to scroll until the
   * overlay has rendered.
   */
  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(() => {
      list.current
        ?.querySelector(`[data-slot-time="${nearestSlot(value)}"]`)
        ?.scrollIntoView({ block: "center" });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, value]);

  return (
    <TimeField
      aria-label={label}
      hourCycle={24}
      isDisabled={isDisabled}
      // Guarded rather than parsed blind: `parseTime` throws, and a row written
      // by an older build or hand-edited in the console must degrade to an empty
      // field the way `parseHours` degrades to a closed day.
      value={isValidTime(value) ? parseTime(value) : null}
      // `null` arrives while a segment is mid-clear. `DayHours` has no partial
      // state — a day with no hours is a day switched off — so the last valid
      // value stands until the user finishes typing the next one.
      onChange={(time) => {
        if (time) onChange(format(time));
      }}
      className="min-w-0"
    >
      {/* `bg-transparent` and `border-border` swap HeroUI's filled field for an
          outlined one: `.date-input-group` paints `--field-background`, and its
          `--field-border` token is already `transparent`, so dropping the fill
          without colouring the border would leave nothing drawing the field's
          edge at all. The border width is already there — this only gives it a
          colour, so nothing reflows. `h-8` against the default `h-9` for the
          reason the day labels are short: seven of these rows share a 448px
          dialog. Both beat HeroUI's own rules with no `!important`, because
          `@heroui/styles` lands in `layer(components)` and Tailwind's utilities
          in `layer(utilities)` after it. */}
      <TimeField.Group
        fullWidth
        className="h-8 min-w-0 border-border bg-transparent"
      >
        {/*
          **`pointer-events-auto` is what makes this clickable, and it is not
          optional.** HeroUI treats a prefix and a suffix as decoration:
          `.date-input-group__prefix` ships `pointer-events: none`, lifted only
          under a `.date-picker` or `.date-range-picker` ancestor — the two
          components of theirs that put a real button in one. A plain TimeField
          gets neither, so without this the clock renders, looks right, and does
          absolutely nothing when pressed. There is no type error and no console
          warning; the only evidence is that rule. Do not remove it as tidy-up.

          `ms-1` overrides the prefix's own 12px inline-start margin, which is
          sized for a full-width form field rather than the seventh row of a
          448px dialog.
        */}
        <TimeField.Prefix className="pointer-events-auto ms-1 me-0">
          <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
            {/*
              A plain Button rather than the repo's `IconButton`, for the reason
              `appearance-button.tsx` gives: that one wraps its trigger in a
              Tooltip, and a tooltip on a popover trigger stays up over the panel
              it just opened.

              `type="button"` is load-bearing — this sits inside the place form,
              and a bare button in a form submits it.
            */}
            <Button
              type="button"
              size="sm"
              variant="tertiary"
              isIconOnly
              isDisabled={isDisabled}
              aria-label={`${label}: pick a time`}
              className="size-6 min-w-0 rounded-md"
            >
              <Clock aria-hidden="true" className="size-3.5" />
            </Button>

            <Popover.Content placement="bottom start">
              <Popover.Dialog aria-label={label}>
                <ListBox
                  ref={list}
                  aria-label={label}
                  selectionMode="single"
                  // Empty for an off-slot time, so the list never claims a
                  // half-hour the location does not actually keep.
                  selectedKeys={TIME_SLOTS.includes(value) ? [value] : []}
                  onSelectionChange={(keys) => {
                    const [picked] = keys === "all" ? [] : [...keys];
                    if (picked) onChange(String(picked));
                    setIsOpen(false);
                  }}
                  className="max-h-56 w-24 overflow-y-auto"
                >
                  {TIME_SLOTS.map((slot) => (
                    <ListBox.Item
                      key={slot}
                      id={slot}
                      textValue={slot}
                      // Read by the scroll effect above. A `ref` per row would
                      // be 48 refs to find one of them by.
                      data-slot-time={slot}
                      className="tabular-nums"
                    >
                      {slot}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Popover.Dialog>
            </Popover.Content>
          </Popover.Root>
        </TimeField.Prefix>

        <TimeField.Input className="px-1.5 py-1 text-xs tabular-nums">
          {(segment) => <TimeField.Segment segment={segment} />}
        </TimeField.Input>
      </TimeField.Group>
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
