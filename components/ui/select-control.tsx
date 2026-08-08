"use client";

import { FieldError, Label, ListBox, Select } from "@heroui/react";

export type SelectOption = {
  id: string;
  label: string;
  description?: string;
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
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  placeholder?: string;
  error?: string;
  isDisabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      fullWidth
      isDisabled={isDisabled}
      isInvalid={Boolean(error)}
      placeholder={placeholder}
      value={value}
      onChange={(key) => onChange(String(key ?? ""))}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
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
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
