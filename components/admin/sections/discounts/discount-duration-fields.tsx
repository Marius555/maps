"use client";

import { Controller, useWatch, type Control } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { SelectControl } from "@/components/ui/select-control";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";
import { DURATION_OPTIONS } from "./discount-options";

/**
 * Which payments of a subscription the discount applies to, and — for "First
 * few months" — how many.
 */
export function DiscountDurationFields({ control }: { control: Control<AdminDiscountForm> }) {
  const duration = useWatch({ control, name: "duration" });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Controller
        control={control}
        name="duration"
        render={({ field }) => (
          <SelectControl
            label="Applies to"
            variant="secondary"
            options={DURATION_OPTIONS}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {duration === "repeating" ? (
        <FormTextField
          control={control}
          name="months"
          label="Months"
          autoComplete="off"
          description="On a yearly plan, the first year's payment counts."
        />
      ) : null}
    </div>
  );
}
