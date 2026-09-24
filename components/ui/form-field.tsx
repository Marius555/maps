"use client";

import {
  Button,
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
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
  /**
   * One line of help under the field — and the line an error takes over.
   *
   * Given, the slot under the input is always occupied: the description, or the
   * error in its place. So a failed submit swaps one line for another instead of
   * inserting one and pushing everything below the field down, which is what the
   * settings pages promise (`docs/notes/settings.md`). Omitted, the field behaves
   * exactly as it always has: nothing under it until there is an error.
   */
  description?: string;
  autoComplete?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
};

/** The line under a field: the error when there is one, else the description. */
function FieldNote({ error, description }: { error?: string; description?: string }) {
  if (error) return <FieldError>{error}</FieldError>;
  if (description) return <Description>{description}</Description>;

  return null;
}

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
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
            <FieldNote error={error} description={description} />
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

/**
 * A password field whose contents can be revealed.
 *
 * Its own component rather than a `showToggle` prop on `FormTextField`, because
 * the markup genuinely differs: a suffix needs `InputGroup` wrapping
 * `InputGroup.Input`, and threading that through the plain field would leave one
 * component rendering two different anatomies depending on a boolean.
 *
 * Everything the doc comment at the top of this file says still applies — the
 * value is React Aria's, so this binds through `Controller` exactly as its
 * siblings do. The `type` here is *display* state and nothing else; the form's
 * value is the same string either way.
 *
 * `type="button"` on the toggle is load-bearing. A `<button>` inside a `<form>`
 * defaults to `type="submit"`, so without it, revealing your password submits
 * the login form with whatever is in it — and React Aria's Button does not set
 * one for you.
 */
export function FormPasswordField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  autoComplete,
  isDisabled,
  autoFocus,
}: FieldProps<T>) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;

        return (
          <TextField
            fullWidth
            type={revealed ? "text" : "password"}
            isDisabled={isDisabled}
            isInvalid={Boolean(error)}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
          >
            <Label>{label}</Label>
            <InputGroup>
              <InputGroup.Input
                ref={field.ref}
                placeholder={placeholder}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
              />
              <InputGroup.Suffix>
                <Button
                  type="button"
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  isDisabled={isDisabled}
                  // The label names what pressing it will do, not the current
                  // state — "Password shown" would leave a screen-reader user
                  // guessing what the control is for.
                  aria-label={revealed ? "Hide password" : "Show password"}
                  onPress={() => setRevealed((shown) => !shown)}
                >
                  {revealed ? (
                    <EyeOff aria-hidden="true" className="size-4" />
                  ) : (
                    <Eye aria-hidden="true" className="size-4" />
                  )}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldNote error={error} description={description} />
          </TextField>
        );
      }}
    />
  );
}
