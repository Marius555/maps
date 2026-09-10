"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
import { useResendVerification } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth.schema";

/**
 * Asks for a fresh confirmation link.
 *
 * It collects the address rather than reading the session, because the state
 * this exists for is "my link expired" — and a link expires in a mail client,
 * which may well not be a browser that has ever been signed in here.
 *
 * Reuses `forgotPasswordSchema`: the request is one email address and inventing
 * a second identical schema is how the two start disagreeing.
 */
export function ResendVerificationForm() {
  const resend = useResendVerification();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resend.mutateAsync(values);
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  if (resend.isSuccess) {
    return (
      <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
        <MailCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Check your email</p>
          {/* Hedged for the same reason the forgot-password success is: the
              route answers the same either way, and a confident message here
              would put back the membership oracle it removed. */}
          <p className="text-xs text-pretty text-muted">
            If that address has an unconfirmed account, a new link is on its way.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {resend.error && !errors.email ? <ErrorMessage error={resend.error} /> : null}

      <FormTextField
        control={control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
      />

      <Button type="submit" fullWidth isPending={isSubmitting}>
        Send a new link
      </Button>
    </form>
  );
}
