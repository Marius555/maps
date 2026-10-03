"use client";

import { Shuffle } from "lucide-react";
import type { Control, UseFormSetValue } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { IconButton } from "@/components/ui/icon-button";
import { randomDiscountCode } from "@/lib/billing/discounts";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";

/** The code customers type, with a button that makes one up. */
export function DiscountCodeField({
  control,
  setValue,
}: {
  control: Control<AdminDiscountForm>;
  setValue: UseFormSetValue<AdminDiscountForm>;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <FormTextField
          control={control}
          name="code"
          label="Code"
          autoComplete="off"
          description="What customers type at the checkout. Letters and digits; saved in capitals."
        />
      </div>
      <IconButton
        label="Make up a code"
        icon={Shuffle}
        variant="secondary"
        size="md"
        className="mt-6 shrink-0"
        onPress={() =>
          setValue("code", randomDiscountCode(), { shouldDirty: true, shouldValidate: true })
        }
      />
    </div>
  );
}
