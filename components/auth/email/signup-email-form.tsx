"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { authHref } from "@/components/auth/method-switch/auth-href";
import { TurnstileSlot } from "@/components/auth/turnstile/turnstile-slot";
import { useTurnstile } from "@/components/auth/turnstile/use-turnstile";
import { FormPasswordField, FormTextField } from "@/components/ui/form-field";
import { track } from "@/lib/posthog/client";
import { useSignup } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastProblem } from "@/lib/query/toast-error";
import { signupSchema, type SignupInput } from "@/lib/validation/auth.schema";

/**
 * Email and password, behind "Continue with email" on `/signup`.
 *
 * **`useTurnstile` must stay in this component.** Its effect renders the widget
 * once, on mount, into `turnstileRef` — and returns early if that container is
 * not in the DOM yet. This form mounts only when the email view is chosen
 * (`AuthMethodSwitch`), so the hook has to mount with it; in the parent it would
 * run while the slot did not exist, never run again, and every signup would wait
 * ten seconds for a token that was never coming and be refused.
 */
export function SignupEmailForm({
  redirectTo,
  autoFocus,
}: {
  redirectTo: string | null;
  autoFocus: boolean;
}) {
  const router = useRouter();
  const signup = useSignup();
  const {
    containerRef: turnstileRef,
    getToken: getHumanToken,
    reset: resetHumanCheck,
    tickPrompt,
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
    // An unticked checkbox is answered under it, not by a request the server
    // can only refuse.
    const human = await getHumanToken();
    if (human.status === "needs-click") return;

    try {
      await signup.mutateAsync({ input: values, humanToken: human.token });
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormTextField
        control={control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus={autoFocus}
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
            href={authHref("/login", { next: redirectTo, email: true })}
            className="underline transition-colors hover:text-foreground"
          >
            Log in
          </Link>
        </p>
      </div>

      <TurnstileSlot ref={turnstileRef} tickPrompt={tickPrompt} submitLabel="Create account" />

      <Button type="submit" fullWidth isPending={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}
