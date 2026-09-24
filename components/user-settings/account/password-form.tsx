"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, toast } from "@heroui/react";
import { useForm } from "react-hook-form";

import { FormPasswordField } from "@/components/ui/form-field";
import { useChangePassword } from "@/lib/query/account";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastError } from "@/lib/query/toast-error";
import { isEmailUnverified } from "@/lib/query/verify-email-toast";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validation/account.schema";

/**
 * Change the password. Only drawn for an account that has one — an account made
 * by Google sign-in is shown no password section at all.
 *
 * **Every field keeps a line under it**, the description until there is an
 * error and the error in its place afterwards (`FormPasswordField`'s
 * `description`). A wrong current password is the common failure here, and it
 * lands in that line rather than pushing the two fields below it down the page.
 *
 * The address rides along in a hidden `username` field. Password managers file
 * a new password under the account named in the same form. Without it they
 * guess, and often save it against nothing.
 */
export function PasswordForm({ email }: { email: string }) {
  const changePassword = useChangePassword();

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isDirty, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync(values);

      reset();
      toast.success("Password changed", {
        description: "Every other device was signed out. This one stays signed in.",
      });
    } catch (error) {
      if (isEmailUnverified(error)) return;
      if (!applyFieldErrors(error, setError)) {
        toastError(error, "Couldn't change your password");
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 sm:max-w-md">
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />

      <FormPasswordField
        control={control}
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        description="The one you sign in with today."
      />

      <FormPasswordField
        control={control}
        name="password"
        label="New password"
        autoComplete="new-password"
        description="At least 8 characters."
      />

      <FormPasswordField
        control={control}
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        description="Type it once more, to be sure."
      />

      <div className="flex justify-end">
        <Button type="submit" isDisabled={!isDirty} isPending={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}
