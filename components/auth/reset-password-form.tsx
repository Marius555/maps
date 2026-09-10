"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormPasswordField } from "@/components/ui/form-field";
import { useResetPassword } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/auth.schema";

/**
 * `userId` and `secret` ride in the form's own values rather than sitting in a
 * closure, so one schema validates the whole request on both sides — the same
 * arrangement CLAUDE.md §9 asks for everywhere else. They are never rendered.
 *
 * Ends signed in: `resetPasswordForUser` mints a session on the new password and
 * the route sets the cookie, so bouncing the user to a login form to retype what
 * they chose four seconds ago would be a step that answers no question.
 */
export function ResetPasswordForm({
  userId,
  secret,
}: {
  userId: string;
  secret: string;
}) {
  const router = useRouter();
  const reset = useResetPassword();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { userId, secret, password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reset.mutateAsync(values);
      router.replace("/maps");
      router.refresh();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  const hasFieldError = Boolean(errors.password || errors.confirmPassword);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {reset.error && !hasFieldError ? (
        <div className="space-y-3">
          <ErrorMessage error={reset.error} />
          {/* A spent or expired link is the likeliest failure here and the user
              cannot recover from it inside this form, so the way out is on
              screen rather than left to be guessed at. */}
          <p className="text-xs text-muted">
            <Link href="/forgot-password" className="text-foreground underline">
              Ask for a new link
            </Link>
          </p>
        </div>
      ) : null}

      <FormPasswordField
        control={control}
        name="password"
        label="New password"
        placeholder="At least 8 characters"
        autoComplete="new-password"
        autoFocus
      />

      <FormPasswordField
        control={control}
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
      />

      <Button type="submit" fullWidth isPending={isSubmitting}>
        Save password
      </Button>
    </form>
  );
}
