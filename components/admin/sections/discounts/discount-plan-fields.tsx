"use client";

import { Checkbox, CheckboxGroup, Description, FieldError, Label } from "@heroui/react";
import { Controller, type Control } from "react-hook-form";

import { offerKey, offerLabel, PLAN_OFFERS } from "@/lib/billing/discounts";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";

/** The plans a code works on. None ticked is every plan. */
export function DiscountPlanFields({ control }: { control: Control<AdminDiscountForm> }) {
  return (
    <Controller
      control={control}
      name="plans"
      render={({ field, fieldState }) => (
        <CheckboxGroup
          variant="secondary"
          value={field.value}
          onChange={field.onChange}
          isInvalid={Boolean(fieldState.error)}
          className="space-y-2"
        >
          <Label>Plans</Label>
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            {PLAN_OFFERS.map((offer) => (
              <Checkbox key={offerKey(offer)} value={offerKey(offer)}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {offerLabel(offer)}
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
          {fieldState.error ? (
            <FieldError>{fieldState.error.message}</FieldError>
          ) : (
            <Description>Leave all unticked for every plan.</Description>
          )}
        </CheckboxGroup>
      )}
    />
  );
}
