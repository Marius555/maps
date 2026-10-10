"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleButton } from "@/components/auth/google-button";
import { LegalConsentNotice } from "@/components/brand/legal-consent-notice";
import { FormPasswordField, FormTextField } from "@/components/ui/form-field";
import { track } from "@/lib/posthog/client";
import { useLogin } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastProblem } from "@/lib/query/toast-error";
import { loginSchema, type LoginInput } from "@/lib/validation/auth.schema";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const login = useLogin();

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      track("user_logged_in");
      router.replace(redirectTo);
      // The dashboard is server-rendered, so the new session has to reach the
      // server before the redirect paints.
      router.refresh();
    } catch (error) {
      // A wrong password is something that just happened, so it is a toast
      // (`lib/query/toast-error.ts`); an inline alert pushed the whole form
      // down the moment it appeared. A field-level 422 still lands on its field.
      if (!applyFieldErrors(error, setError)) toastProblem("Couldn't log in", error);
    }
  });

  return (
    <div className="space-y-5">
      {/* Above the form, because for anyone who has one it is the shorter path
          and putting it underneath makes it the thing you find after failing. */}
      <GoogleButton redirectTo={redirectTo} />

      <AuthDivider />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
              field's accessible name. The way to sign up shares the line, at
              the same size, rather than sitting in a footer of its own. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              No account yet?{" "}
              <Link
                href={
                  redirectTo === "/maps"
                    ? "/signup"
                    : `/signup?next=${encodeURIComponent(redirectTo)}`
                }
                className="underline transition-colors hover:text-foreground"
              >
                Sign up
              </Link>
            </span>
            <Link
              href="/forgot-password"
              className="underline transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" fullWidth isPending={isSubmitting}>
          Log in
        </Button>
      </form>

      {/* Here as well as on signup: Continue with Google creates the account on
          first press from this page too. */}
      <LegalConsentNotice />
    </div>
  );
}
