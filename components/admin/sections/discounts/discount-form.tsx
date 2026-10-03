"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormDateTimeField } from "@/components/ui/form-date-time-field";
import { FormTextField } from "@/components/ui/form-field";
import { wallClockToIso } from "@/lib/format/wall-clock";
import { useCreateDiscount } from "@/lib/query/admin";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastProblem } from "@/lib/query/toast-error";
import { adminDiscountFormSchema, type AdminDiscountForm } from "@/lib/validation/discount.schema";
import { DiscountAmountFields } from "./discount-amount-fields";
import { DiscountCodeField } from "./discount-code-field";
import { DiscountDurationFields } from "./discount-duration-fields";
import { DiscountPlanFields } from "./discount-plan-fields";

/**
 * Make a discount code at the payment provider.
 *
 * The two dates are in the admin's own clock and sent as ISO, as the
 * notification form's are. The list is server-rendered from the provider, so
 * a create ends in `router.refresh()` rather than a cache patch.
 */
export function DiscountForm({
  defaultValues,
  onDone,
}: {
  defaultValues: AdminDiscountForm;
  onDone: () => void;
}) {
  const router = useRouter();
  const create = useCreateDiscount();

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { isSubmitting },
  } = useForm<AdminDiscountForm>({
    resolver: zodResolver(adminDiscountFormSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const discount = await create.mutateAsync({
        ...values,
        startsAt: wallClockToIso(values.startsAt),
        expiresAt: wallClockToIso(values.expiresAt),
      });

      toast.success("Discount created", {
        description: `${discount.code} works at the checkout${values.startsAt ? " from the start time you set" : " now"}.`,
      });
      router.refresh();
      onDone();
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toastProblem("Couldn't create the discount", error);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormTextField
        control={control}
        name="name"
        label="Name"
        autoComplete="off"
        description="To tell your discounts apart, like “Spring launch”."
      />
      <DiscountCodeField control={control} setValue={setValue} />
      <DiscountAmountFields control={control} />
      <DiscountDurationFields control={control} />

      <FormTextField
        control={control}
        name="maxUses"
        label="Uses"
        autoComplete="off"
        description="How many times it can be used in total, by anyone. Leave empty for no limit."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormDateTimeField
          control={control}
          name="startsAt"
          label="Starts"
          description="Your local time. Leave empty to start now."
        />
        <FormDateTimeField
          control={control}
          name="expiresAt"
          label="Expires"
          description="Your local time. Leave empty to never expire."
        />
      </div>

      <DiscountPlanFields control={control} />

      <p className="text-xs text-muted">
        A discount can&apos;t be edited after it&apos;s created, only deleted. It works for new
        checkouts; customers who already pay can&apos;t apply it to their plan.
      </p>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="tertiary" onPress={onDone} isDisabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isPending={isSubmitting}>
          Create discount
        </Button>
      </div>
    </form>
  );
}
