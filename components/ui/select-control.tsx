"use client";

import { FieldError, Label, ListBox, Select } from "@heroui/react";
import type { ReactNode } from "react";

export type SelectOption = {
  id: string;
  label: string;
  description?: string;
  /**
   * Heading for the run of options this one belongs to.
   *
   * Contiguous options sharing a section are grouped under it. Only
   * `InlineSelect` draws these — a labelled form select over a flat list of
   * choices has nothing to group, and this control ignores both this and `icon`.
   */
  section?: string;
  /** Leading mark, e.g. how well the option fits. */
  icon?: ReactNode;
};

/**
 * A labelled select over a flat option list.
 *
 * HeroUI v3's Select is compound and React Aria driven — it takes a `value`/
 * `onChange` key pair rather than a DOM event, so it can't be handed to
 * react-hook-form's `register`. Forms wrap it in a `Controller`.
 */
export function SelectControl({
  label,
  options,
  value,
  placeholder,
  error,
  isDisabled,
  variant,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  placeholder?: string;
  error?: string;
  isDisabled?: boolean;
  /**
   * `"secondary"` for a select sitting on a `SectionPanel` or any other raised
   * surface, which is what HeroUI documents the variant for.
   *
   * It is not cosmetic here. `.select--secondary` paints the trigger
   * `var(--default)` where the default variant uses `var(--field)` — and in this
   * theme `--field-background` is *the same colour as* `--surface`, with
   * `--field-border: transparent` (app/globals.css). On a page background that
   * reads as a field; on a panel it reads as nothing at all, which is how the
   * card designer's selects ended up invisible. Fixed per-caller rather than on
   * the token, since `--field-border` is every input in the app.
   */
  variant?: "primary" | "secondary";
  onChange: (value: string) => void;
}) {
  return (
    <Select
      fullWidth
      isDisabled={isDisabled}
      isInvalid={Boolean(error)}
      placeholder={placeholder}
      value={value}
      variant={variant}
      onChange={(key) => onChange(String(key ?? ""))}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        {/* min-w-0 on the value, so a long option truncates rather than pushing
            the indicator out of the trigger. */}
        <Select.Value className="min-w-0 overflow-hidden" />
        <Select.Indicator />
      </Select.Trigger>
      {error ? <FieldError>{error}</FieldError> : null}

      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
            >
              {/* The description sits under the label rather than beside it, so
                  a long one truncates instead of pushing the indicator off the
                  row. `min-w-0` is what lets the truncation actually happen
                  inside a flex parent. */}
              <span className="flex w-full min-w-0 flex-col overflow-hidden">
                <span className="truncate">{option.label}</span>
                {option.description ? (
                  <span className="truncate text-xs text-muted">
                    {option.description}
                  </span>
                ) : null}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
