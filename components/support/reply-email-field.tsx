"use client";

import { ComboBox, Description, FieldError, Input, Label, ListBox } from "@heroui/react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

/**
 * Where our reply goes: the signed-in address, or any other one typed in.
 *
 * A ComboBox with `allowsCustomValue`, so the account's address is the one
 * listed option — pick it, or type over it. The form starts with it filled in,
 * because it is the right answer almost every time.
 *
 * Bound through `Controller` to the input's own text, not `register()`: React
 * Aria owns the value (see `components/ui/form-field.tsx`). `defaultFilter`
 * keeps the account address listed while something else is typed, so the way
 * back to it is always one press away.
 */
export function ReplyEmailField<T extends FieldValues>({
  control,
  name,
  accountEmail,
}: {
  control: Control<T>;
  name: Path<T>;
  accountEmail: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ComboBox
          fullWidth
          allowsCustomValue
          allowsEmptyCollection
          defaultFilter={() => true}
          inputValue={field.value ?? ""}
          onInputChange={field.onChange}
          onSelectionChange={(key) => {
            if (key === "account") field.onChange(accountEmail);
          }}
          isInvalid={Boolean(fieldState.error)}
        >
          <Label>Reply to</Label>
          <ComboBox.InputGroup>
            <Input
              ref={field.ref}
              type="email"
              autoComplete="email"
              onBlur={field.onBlur}
            />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          {fieldState.error ? (
            <FieldError>{fieldState.error.message}</FieldError>
          ) : (
            <Description>We&apos;ll answer at this address.</Description>
          )}
          <ComboBox.Popover>
            <ListBox>
              <ListBox.Item id="account" textValue={accountEmail}>
                <div className="flex min-w-0 flex-col">
                  <Label>Use my account email</Label>
                  <Description className="truncate">{accountEmail}</Description>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
      )}
    />
  );
}
