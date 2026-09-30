"use client";

import { Checkbox, CheckboxGroup, FieldError, Label } from "@heroui/react";
import { Controller, useWatch, type Control } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { PLAN_VALUES, type AdminNotificationForm } from "@/lib/validation/notification.schema";
import { PLAN_NAMES } from "./notification-options";

/**
 * The part of the audience that depends on which audience it is: the plans to
 * send to, or the account's email. Nothing for "Everyone".
 */
export function AudienceFields({ control }: { control: Control<AdminNotificationForm> }) {
  const audience = useWatch({ control, name: "audience" });

  if (audience === "user") {
    return (
      <FormTextField
        control={control}
        name="audienceEmail"
        label="Account email"
        type="email"
        autoComplete="off"
        description="The address the owner signs in with."
      />
    );
  }

  if (audience !== "plan") return null;

  return (
    <Controller
      control={control}
      name="audiencePlans"
      render={({ field, fieldState }) => (
        <CheckboxGroup
          variant="secondary"
          value={field.value}
          onChange={field.onChange}
          isInvalid={Boolean(fieldState.error)}
          className="space-y-2"
        >
          <Label>Plans</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {PLAN_VALUES.map((plan) => (
              <Checkbox key={plan} value={plan}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {PLAN_NAMES[plan]}
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
          {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : null}
        </CheckboxGroup>
      )}
    />
  );
}
