"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleButton } from "@/components/auth/google-button";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormPasswordField, FormTextField } from "@/components/ui/form-field";
import { useLogin } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { loginSchema, type LoginInput } from "@/lib/validation/auth.schema";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const login = useLogin();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(redirectTo);
      // The dashboard is server-rendered, so the new session has to reach the
      // server before the redirect paints.
      router.refresh();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <div className="space-y-5">
      {/* Above the form, because for anyone who has one it is the shorter path
          and putting it underneath makes it the thing you find after failing. */}
      <GoogleButton />

      <AuthDivider />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {login.error && !errors.email && !errors.password ? (
          <ErrorMessage error={login.error} />
        ) : null}

        <FormTextField
          control={control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />

        <div className="space-y-1.5">
          <FormPasswordField
            control={control}
            name="password"
            label="Password"
            autoComplete="current-password"
          />

          {/* Under the field rather than beside its label: React Aria owns the
              label row, and a link inside it would be read out as part of the
              field's accessible name. */}
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-muted underline transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" fullWidth isPending={isSubmitting}>
          Log in
        </Button>
      </form>
    </div>
  );
}
