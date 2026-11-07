"use client";

import Link from "next/link";

import { SignupEmailForm } from "@/components/auth/email/signup-email-form";
import { authHref, type AuthView } from "@/components/auth/method-switch/auth-href";
import { AuthMethodSwitch } from "@/components/auth/method-switch/auth-method-switch";
import { OAuthButtons } from "@/components/auth/oauth/oauth-buttons";
import { LegalConsentNotice } from "@/components/brand/legal-consent-notice";

/**
 * `/signup`: the login page's layout, deliberately. CLAUDE.md §8: an action
 * keeps its name through the whole flow, and with Google or GitHub there is no
 * difference between signing in and signing up — the first press makes the
 * account either way.
 */
export function SignupForm({
  redirectTo = null,
  initialView,
}: {
  redirectTo?: string | null;
  initialView: AuthView;
}) {
  return (
    <div className="space-y-5">
      <AuthMethodSwitch
        initialView={initialView}
        providers={<OAuthButtons redirectTo={redirectTo ?? undefined} />}
        providersFooter={
          <p className="text-center text-xs text-muted">
            Already have an account?{" "}
            <Link
              href={authHref("/login", { next: redirectTo })}
              className="underline transition-colors hover:text-foreground"
            >
              Log in
            </Link>
          </p>
        }
        renderEmail={(autoFocus) => (
          <SignupEmailForm redirectTo={redirectTo} autoFocus={autoFocus} />
        )}
      />

      <LegalConsentNotice />
    </div>
  );
}
