"use client";

import Link from "next/link";

import { LoginEmailForm } from "@/components/auth/email/login-email-form";
import { authHref, type AuthView } from "@/components/auth/method-switch/auth-href";
import { AuthMethodSwitch } from "@/components/auth/method-switch/auth-method-switch";
import { OAuthButtons } from "@/components/auth/oauth/oauth-buttons";
import { LegalConsentNotice } from "@/components/brand/legal-consent-notice";

/**
 * `/login`: Google and GitHub first, because for anyone who has one it is the
 * shorter path; email and password one press away (`AuthMethodSwitch`).
 */
export function LoginForm({
  redirectTo,
  initialView,
}: {
  redirectTo: string;
  initialView: AuthView;
}) {
  return (
    <div className="space-y-5">
      <AuthMethodSwitch
        initialView={initialView}
        providers={<OAuthButtons redirectTo={redirectTo} />}
        providersFooter={
          <p className="text-center text-xs text-muted">
            No account yet?{" "}
            <Link
              href={authHref("/signup", { next: redirectTo })}
              className="underline transition-colors hover:text-foreground"
            >
              Sign up
            </Link>
          </p>
        }
        renderEmail={(autoFocus) => (
          <LoginEmailForm redirectTo={redirectTo} autoFocus={autoFocus} />
        )}
      />

      {/* Outside the switch, so it is on screen in both views: signing in with
          Google or GitHub creates the account on first press from this page too. */}
      <LegalConsentNotice />
    </div>
  );
}
