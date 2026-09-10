"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
import { useForgotPassword } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth.schema";

export function ForgotPasswordForm() {
  const forgot = useForgotPassword();

  const {
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync(values);
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  /**
   * **The copy hedges on purpose.** The route answers identically whether or not
   * the address has an account, so that nobody can use this form to find out who
   * banks here. A success message that said "check your inbox" would give away
   * exactly what the route refuses to — the leak would just have moved from the
   * network tab to the screen.
   */
  if (forgot.isSuccess) {
    return (
      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
          <MailCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Check your email</p>
            <p className="text-xs text-pretty text-muted">
              If {getValues("email")} has an account, a link to choose a new
              password is on its way. It works once and expires in an hour.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted">
          <Link href="/login" className="text-foreground underline">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {forgot.error && !errors.email ? <ErrorMessage error={forgot.error} /> : null}

      <FormTextField
        control={control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
      />

      <Button type="submit" fullWidth isPending={isSubmitting}>
        Email me a link
      </Button>
    </form>
  );
}
