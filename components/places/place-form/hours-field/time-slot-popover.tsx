"use client";

import { Button, ListBox, Popover } from "@heroui/react";
import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DayHours } from "@/packages/shared/hours";
import { nearestSlot, TIME_SLOTS } from "./time-slots";

type Open = NonNullable<DayHours>;

/**
 * The clock at the front of a day's hours: one popover, two columns.
 *
 * Opening and closing time used to be two separate fields with a clock each —
 * two popovers per day, fourteen in the fold. A day's hours are one question, so
 * they are one list pair: "Opens" on the left, "Closes" on the right, each
 * scrolled to the time it already holds, and the time each half holds is filled
 * with the accent so it can be seen without reading every row.
 *
 * Picking in either column writes that half at once and keeps the popover open
 * for the other; **once both have been picked, in either order, it closes.**
 * Escape or a click outside still closes it early, keeping whatever was picked.
 *
 * **HeroUI v3 ships no TimePicker** — `time-field`, `date-field`, `date-picker`
 * and `calendar`, and nothing between them — so this is composed from HeroUI
 * parts the way their `DatePicker` is: a field, a trigger and a `Popover`. The
 * list covers the half-hours opening hours actually keep; the segments beside it
 * take 09:37 for the one shop that opens then.
 */
export function TimeSlotPopover({
  label,
  value,
  onChange,
}: {
  /** The full day name, for the trigger's and the lists' accessible names. */
  label: string;
  value: Open;
  onChange: (value: Open) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // Which halves have been picked since the popover last opened.
  const [picked, setPicked] = useState(NONE_PICKED);

  const openChange = (open: boolean) => {
    if (open) setPicked(NONE_PICKED);
    setIsOpen(open);
  };

  const pick = (half: keyof Open, time: string) => {
    onChange({ ...value, [half]: time });

    const next = { ...picked, [half]: true };
    setPicked(next);
    if (next.open && next.close) setIsOpen(false);
  };

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={openChange}>
      {/*
        A plain Button rather than the repo's `IconButton`, for the reason
        `appearance-button.tsx` gives: that one wraps its trigger in a Tooltip,
        and a tooltip on a popover trigger stays up over the panel it just opened.

        `type="button"` is load-bearing — this sits inside the place form, and a
        bare button in a form submits it.
      */}
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        isIconOnly
        aria-label={`${label}: pick times`}
        className="size-7 min-w-0 rounded-md"
      >
        <Clock aria-hidden="true" className="size-3.5" />
      </Button>

      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label={`${label} hours`} className="flex gap-2 p-2">
          <SlotColumn
            title="Opens"
            label={`${label}: opens at`}
            value={value.open}
            isOpen={isOpen}
            onPick={(time) => pick("open", time)}
          />
          <SlotColumn
            title="Closes"
            label={`${label}: closes at`}
            value={value.close}
            isOpen={isOpen}
            onPick={(time) => pick("close", time)}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

const NONE_PICKED = { open: false, close: false };

function SlotColumn({
  title,
  label,
  value,
  isOpen,
  onPick,
}: {
  title: string;
  label: string;
  value: string;
  isOpen: boolean;
  onPick: (value: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);

  // Read by the effect below without being one of its dependencies: it centres
  // the list on *opening*, and re-centring on every pick would yank the list out
  // from under the pointer that just chose from it.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  /*
   * Open the list next to the time it is already showing.
   *
   * A list that opens at 00:00 makes someone setting a 9am opening scroll past
   * eighteen rows to reach it. Done by scrolling rather than by selecting
   * `nearestSlot`, because 09:37 has no slot and ticking 09:30 to make the list
   * move would draw a checkmark beside a time the location does not keep.
   *
   * `scrollTop` on the list's own box, not `scrollIntoView` on the row: that
   * scrolls every ancestor too, and one of them is the dialog.
   *
   * After paint, not in a layout effect: React Aria mounts the popover's content
   * in a portal, so the rows do not exist to scroll until the overlay rendered.
   */
  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(() => {
      const box = list.current;
      const row = box?.querySelector<HTMLElement>(
        `[data-slot-time="${nearestSlot(latest.current)}"]`,
      );
      if (!box || !row) return;

      box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2;
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 text-xs font-medium text-muted">{title}</span>
      <ListBox
        ref={list}
        aria-label={label}
        selectionMode="single"
        // Empty for an off-slot time, so the list never claims a half-hour the
        // location does not actually keep.
        selectedKeys={TIME_SLOTS.includes(value) ? [value] : []}
        onSelectionChange={(keys) => {
          const [picked] = keys === "all" ? [] : [...keys];
          // Empty is a click on the row already selected — single selection
          // reports it as a deselect. It is still a pick of that time, and the
          // selection is controlled, so the row stays filled.
          onPick(picked === undefined ? value : String(picked));
        }}
        className="relative max-h-56 w-24 overflow-y-auto"
      >
        {TIME_SLOTS.map((slot) => (
          <ListBox.Item
            key={slot}
            id={slot}
            textValue={slot}
            // Read by the scroll effect above. A `ref` per row would be 48 refs
            // to find one of them by.
            data-slot-time={slot}
            // HeroUI's selected rule is empty — it leans on a checkmark
            // indicator — so the fill is ours, and hovering keeps it.
            className="tabular-nums data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[selected=true]:data-[hovered=true]:bg-accent"
          >
            {slot}
          </ListBox.Item>
        ))}
      </ListBox>
    </div>
  );
}
