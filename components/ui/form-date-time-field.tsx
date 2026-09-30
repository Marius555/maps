"use client";

import {
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Label,
} from "@heroui/react";
import { parseDateTime, type CalendarDateTime } from "@internationalized/date";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { IconButton } from "./icon-button";

/**
 * A date and time, bound to react-hook-form — HeroUI's `DatePicker` with a
 * calendar popover, never the browser's own `datetime-local`.
 *
 * The native input was what this replaced, and it is the tell in a HeroUI app:
 * the field looked like ours until it was opened, and then the operating
 * system's calendar appeared, in the OS's theme and its locale's layout.
 *
 * **The form value stays a wall-clock string** (`YYYY-MM-DDTHH:mm[:ss]`, no
 * zone) — the same shape `datetime-local` produced — so schemas and the code
 * that turns it into ISO are unchanged. `""` is empty, and empty usually means
 * something ("send now", "never"), so a set value can be cleared with one press.
 *
 * Bound through `Controller` for the reason `form-field.tsx` gives: React Aria
 * owns the value.
 *
 * **The segments render on the client only.** React Aria lays them out in the
 * user's locale, which the server does not know: it falls back to en-US
 * (`mm/dd/yyyy, --:-- AM`) while the browser reads `navigator.language` — an
 * lt-LT browser draws `yyyy-mm-dd --:--`, and hydration failed on the first
 * separator. The field's box still server-renders, so nothing shifts.
 */
export function FormDateTimeField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  isDisabled,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** One line under the field — and the line an error takes over. */
  description?: string;
  isDisabled?: boolean;
}) {
  const isClient = useIsClient();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;
        const value = toDateTime(field.value);

        return (
          <DatePicker
            className="w-full"
            granularity="minute"
            isDisabled={isDisabled}
            isInvalid={Boolean(error)}
            value={value}
            onChange={(next) => field.onChange(next ? next.toString() : "")}
            onBlur={field.onBlur}
          >
            <Label>{label}</Label>
            <DateField.Group fullWidth>
              <DateField.Input>
                {(segment) => (isClient ? <DateField.Segment segment={segment} /> : <></>)}
              </DateField.Input>
              <DateField.Suffix>
                {value ? (
                  <IconButton
                    label={`Clear ${label.toLowerCase()}`}
                    icon={X}
                    variant="ghost"
                    size="sm"
                    isDisabled={isDisabled}
                    onPress={() => field.onChange("")}
                  />
                ) : null}
                <DatePicker.Trigger>
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            {error ? (
              <FieldError>{error}</FieldError>
            ) : description ? (
              <Description>{description}</Description>
            ) : null}
            <DatePicker.Popover>
              <Calendar aria-label={label}>
                <Calendar.Header>
                  <Calendar.YearPickerTrigger>
                    <Calendar.YearPickerTriggerHeading />
                    <Calendar.YearPickerTriggerIndicator />
                  </Calendar.YearPickerTrigger>
                  <Calendar.NavButton slot="previous" />
                  <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                </Calendar.Grid>
                <Calendar.YearPickerGrid>
                  <Calendar.YearPickerGridBody>
                    {({ year }) => <Calendar.YearPickerCell year={year} />}
                  </Calendar.YearPickerGridBody>
                </Calendar.YearPickerGrid>
              </Calendar>
            </DatePicker.Popover>
          </DatePicker>
        );
      }}
    />
  );
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true from the first client render after. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** The form's wall-clock string as a date-time, or null for empty or unreadable. */
function toDateTime(value: unknown): CalendarDateTime | null {
  if (typeof value !== "string" || value === "") return null;

  try {
    return parseDateTime(value);
  } catch {
    return null;
  }
}
