"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, toast } from "@heroui/react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";

import { FormDateTimeField } from "@/components/ui/form-date-time-field";
import { FormTextArea, FormTextField } from "@/components/ui/form-field";
import { SelectControl } from "@/components/ui/select-control";
import { useSendNotification } from "@/lib/query/admin";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastProblem } from "@/lib/query/toast-error";
import {
  adminNotificationFormSchema,
  type AdminNotificationForm,
} from "@/lib/validation/notification.schema";
import { AudienceFields } from "./audience-fields";
import { NotificationPreview } from "./notification-preview";
import { AUDIENCE_OPTIONS, EMPTY_NOTIFICATION, KIND_OPTIONS } from "./notification-options";

/**
 * Write a notification to owners: everyone, some plans, or one account.
 *
 * The two dates are HeroUI `DatePicker`s in the admin's own clock
 * (`FormDateTimeField`), held as wall-clock strings and sent to the server as
 * ISO. After a send the Sent list is server-rendered, so it is
 * refreshed rather than patched.
 */
export function NotificationComposeForm() {
  const router = useRouter();
  const send = useSendNotification();

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isSubmitting },
  } = useForm<AdminNotificationForm>({
    resolver: zodResolver(adminNotificationFormSchema),
    defaultValues: EMPTY_NOTIFICATION,
  });

  const onSubmit = handleSubmit(async (values) => {
    const publishedAt = toIso(values.publishedAt);

    try {
      await send.mutateAsync({ ...values, publishedAt, expiresAt: toIso(values.expiresAt) });

      toast.success("Sent", {
        description:
          isFuture(publishedAt)
            ? "Owners see it from the time you set."
            : "Owners see it the next time their dashboard checks.",
      });
      reset(EMPTY_NOTIFICATION);
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toastProblem("Couldn't send the notification", error);
    }
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <form onSubmit={onSubmit} className="min-w-0 space-y-4" noValidate>
        <FormTextField control={control} name="title" label="Title" autoComplete="off" />
        <FormTextArea control={control} name="body" label="Message" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <SelectControl
                label="Kind"
                variant="secondary"
                options={KIND_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="audience"
            render={({ field }) => (
              <SelectControl
                label="Send to"
                variant="secondary"
                options={AUDIENCE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <AudienceFields control={control} />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormTextField
            control={control}
            name="linkUrl"
            label="Link"
            autoComplete="off"
            description="Optional. https://… or a path like /settings/billing."
          />
          <FormTextField
            control={control}
            name="linkLabel"
            label="Button label"
            autoComplete="off"
            description="The words on the link's button."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormDateTimeField
            control={control}
            name="publishedAt"
            label="Send at"
            description="Your local time. Leave empty to send now."
          />
          <FormDateTimeField
            control={control}
            name="expiresAt"
            label="Expires"
            description="Your local time. Leave empty to keep showing it."
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" isPending={isSubmitting} className="w-full sm:w-auto">
            <Send aria-hidden="true" className="size-4" />
            Send
          </Button>
        </div>
      </form>

      <div className="min-w-0 xl:sticky xl:top-8 xl:self-start">
        <NotificationPreview control={control} />
      </div>
    </div>
  );
}

/** A wall-clock date-time, read in the browser's zone, as ISO; "" stays "". */
function toIso(local: string): string {
  if (!local) return "";
  const date = new Date(local);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isFuture(iso: string): boolean {
  return iso !== "" && Date.parse(iso) > Date.now();
}
