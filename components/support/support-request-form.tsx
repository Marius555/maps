"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, toast } from "@heroui/react";
import { Controller, useForm } from "react-hook-form";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextArea } from "@/components/ui/form-field";
import { useSendSupportRequest } from "@/lib/query/account";
import { applyFieldErrors } from "@/lib/query/form-errors";
import {
  BUG_AREAS,
  SUPPORT_TOPICS,
  supportRequestSchema,
  type SupportKind,
  type SupportRequestFormValues,
  type SupportRequestInput,
} from "@/lib/validation/support.schema";
import { KindOptions } from "./kind-options";
import { ReplyEmailField } from "./reply-email-field";

const COPY: Record<
  SupportKind,
  { options: string; message: string; submit: string; sent: string }
> = {
  bug: {
    options: "Where did it happen?",
    message: "What went wrong?",
    submit: "Send report",
    sent: "Report sent",
  },
  support: {
    options: "What's it about?",
    message: "How can we help?",
    submit: "Send message",
    sent: "Message sent",
  },
};

function defaults(kind: SupportKind, accountEmail: string): SupportRequestFormValues {
  return kind === "bug"
    ? { kind, area: BUG_AREAS[0].id, message: "", replyTo: accountEmail }
    : { kind, topic: SUPPORT_TOPICS[0].id, message: "", replyTo: accountEmail };
}

/**
 * A bug report or a support request: what it is about, what happened, and
 * where to reply. The page and the screen size are added on submit, so they
 * are never asked for.
 *
 * The `<form>` wraps the dialog's body *and* footer, so the buttons are a real
 * dialog footer — one row, pinned under the body in the sheet as in the modal.
 */
export function SupportRequestForm({
  kind,
  accountEmail,
  onSent,
}: {
  kind: SupportKind;
  accountEmail: string;
  onSent: () => void;
}) {
  const send = useSendSupportRequest();
  const copy = COPY[kind];

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupportRequestFormValues, unknown, SupportRequestInput>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: defaults(kind, accountEmail),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await send.mutateAsync({
        ...values,
        page: `${window.location.pathname}${window.location.search}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
      toast.success(copy.sent, {
        description: "Thanks — we'll reply by email.",
      });
      onSent();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <ResponsiveDialog.Body className="space-y-4">
        {send.error && !errors.message && !errors.replyTo ? (
          <ErrorMessage error={send.error} />
        ) : null}

        {kind === "bug" ? (
          <Controller
            control={control}
            name="area"
            render={({ field }) => (
              <KindOptions
                label={copy.options}
                options={BUG_AREAS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="topic"
            render={({ field }) => (
              <KindOptions
                label={copy.options}
                options={SUPPORT_TOPICS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        )}

        <FormTextArea control={control} name="message" label={copy.message} />

        <ReplyEmailField control={control} name="replyTo" accountEmail={accountEmail} />
      </ResponsiveDialog.Body>

      <ResponsiveDialog.Footer>
        <Button slot="close" variant="tertiary" className="flex-1 sm:flex-none">
          Cancel
        </Button>
        <Button type="submit" isPending={isSubmitting} className="flex-1 sm:flex-none">
          {copy.submit}
        </Button>
      </ResponsiveDialog.Footer>
    </form>
  );
}
