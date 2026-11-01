"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleButton } from "@/components/auth/google-button";
import { TurnstileSlot } from "@/components/auth/turnstile/turnstile-slot";
import { useTurnstile } from "@/components/auth/turnstile/use-turnstile";
import { LegalConsentNotice } from "@/components/brand/legal-consent-notice";
import { FormPasswordField, FormTextField } from "@/components/ui/form-field";
import { track } from "@/lib/posthog/client";
import { useSignup } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastProblem } from "@/lib/query/toast-error";
import { signupSchema, type SignupInput } from "@/lib/validation/auth.schema";

export function SignupForm({ redirectTo = null }: { redirectTo?: string | null }) {
  const router = useRouter();
  const signup = useSignup();
  const {
    containerRef: turnstileRef,
    getToken: getHumanToken,
    reset: resetHumanCheck,
  } = useTurnstile("signup");

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  /**
   * Straight to "check your inbox", not to the dashboard.
   *
   * The account exists and the session cookie is written by this point, so
   * `/maps` would render — and every control on it would be dead, because an
   * unconfirmed address is refused every write (`lib/auth/email-gate.ts`). The
   * one thing this person needs to do next is in their email, so that is the
   * screen they get; it links on to the dashboard for anyone who wants to look
   * around first.
   *
   * `/verify-email` is outside `proxy.ts`'s matcher, which matters for a
   * different reason on this path than on the emailed one: here the navigation is
   * same-site and the cookie would be sent either way.
   */
  const onSubmit = handleSubmit(async (values) => {
    try {
      await signup.mutateAsync({ input: values, humanToken: await getHumanToken() });
      track("user_signed_up");
      // Somewhere that asked to have them back — `/connect/wordpress` — shows its
      // own "check your inbox" and carries on once they have.
      router.replace(redirectTo ?? "/verify-email?status=sent");
      router.refresh();
    } catch (error) {
      // The token was spent on this attempt whatever went wrong, so the next
      // press needs a new one.
      resetHumanCheck();

      // The login form's rule: what just failed is a toast, and a field-level
      // 422 (a throwaway address, a taken one) still lands on its field.
      if (!applyFieldErrors(error, setError)) {
        toastProblem("Couldn't create your account", error);
      }
    }
  });

  return (
    <div className="space-y-5">
      {/* The same words as the login page, deliberately. CLAUDE.md §8: an action
          keeps its name through the whole flow, and with Google there is no
          difference between signing in and signing up — the first press makes
          the account either way. */}
      <GoogleButton redirectTo={redirectTo ?? undefined} />

      <AuthDivider />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormTextField
          control={control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />

        <FormPasswordField
          control={control}
          name="password"
          label="Password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />

        <div className="space-y-1.5">
          <FormPasswordField
            control={control}
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
          />

          {/* The login form's line, mirrored: under the field, at its size,
              rather than a footer of its own below everything else. */}
          <p className="text-xs text-muted">
            Already have an account?{" "}
            <Link
              href={redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : "/login"}
              className="underline transition-colors hover:text-foreground"
            >
              Log in
            </Link>
          </p>
        </div>

        <TurnstileSlot ref={turnstileRef} />

        <Button type="submit" fullWidth isPending={isSubmitting}>
          Create account
        </Button>
      </form>

      <LegalConsentNotice />
    </div>
  );
}
