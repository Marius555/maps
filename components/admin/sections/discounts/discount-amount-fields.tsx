"use client";

import { Controller, useWatch, type Control } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { SelectControl } from "@/components/ui/select-control";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";
import { AMOUNT_TYPE_OPTIONS } from "./discount-options";

/** Percentage or euros off, and how much. */
export function DiscountAmountFields({ control }: { control: Control<AdminDiscountForm> }) {
  const amountType = useWatch({ control, name: "amountType" });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Controller
        control={control}
        name="amountType"
        render={({ field }) => (
          <SelectControl
            label="Discount"
            variant="secondary"
            options={AMOUNT_TYPE_OPTIONS}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <FormTextField
        control={control}
        name="amount"
        label={amountType === "percent" ? "Percent off" : "Euros off"}
        autoComplete="off"
        placeholder={amountType === "percent" ? "20" : "5.00"}
        description={
          amountType === "percent" ? "A whole number, 1 to 100." : "Taken off each discounted payment."
        }
      />
    </div>
  );
}
