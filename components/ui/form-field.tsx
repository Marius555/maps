"use client";

import { FieldError, Input, Label, TextArea, TextField } from "@heroui/react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

/**
 * Form fields bound to react-hook-form through `Controller`.
 *
 * Not `register()`. HeroUI v3's TextField is React Aria, and React Aria owns the
 * input's value — it renders `value` from the TextField's own state, which
 * overwrites anything `register`'s ref assigns. The failure is silent and
 * one-directional: typing into an empty field works, so login and signup look
 * fine, but a form opened with existing values renders them blank and then saves
 * the blanks. Passing value/onChange to the TextField is the only correct wiring.
 *
 * `Controller` rather than `useController` because the field object carries a ref,
 * and reading it during render trips the React Compiler's refs rule. A render prop
 * keeps that access inside a callback.
 */

type FieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /**
   * A rule or an action — never an example value.
   *
   * Every field here already has a visible `<Label>`, so a placeholder adds no
   * name; all it can add is the illusion of content. "Corner Shop" in an empty
   * Name box, "52.5200" in an empty Latitude box, next to an error saying the row
   * has no coordinates — the user reads those as saved and goes looking for a
   * different bug. Empty is the honest rendering of empty. `"At least 8
   * characters"` is the shape that survives: it states a constraint, and no
   * password ever looked like it.
   */
  placeholder?: string;
  autoComplete?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
};

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  autoComplete,
  isDisabled,
  autoFocus,
  type = "text",
}: FieldProps<T> & {
  type?: "text" | "email" | "password" | "tel" | "url";
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;

        return (
          <TextField
            fullWidth
            type={type}
            isDisabled={isDisabled}
            isInvalid={Boolean(error)}
            // ?? "" because a null from the database would make React Aria warn
            // about switching between controlled and uncontrolled.
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
          >
            <Label>{label}</Label>
            <Input
              ref={field.ref}
              placeholder={placeholder}
              autoComplete={autoComplete}
              autoFocus={autoFocus}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </TextField>
        );
      }}
    />
  );
}

export function FormTextArea<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  isDisabled,
}: FieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;

        return (
          <TextField
            fullWidth
            isDisabled={isDisabled}
            isInvalid={Boolean(error)}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
          >
            <Label>{label}</Label>
            <TextArea
              ref={field.ref}
              className="min-h-24"
              placeholder={placeholder}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </TextField>
        );
      }}
    />
  );
}
