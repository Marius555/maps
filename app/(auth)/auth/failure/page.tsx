import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LinkButton } from "@/components/ui/link-button";

export const metadata: Metadata = {
  title: "Sign-in failed",
  robots: { index: false, follow: false },
};

/**
 * Where Appwrite sends the browser when the OAuth round trip does not complete.
 *
 * Appwrite passes no machine-readable reason to the failure URL, so there is
 * nothing here to branch on and inventing a cause would be guessing at the user.
 * What it can do is name the two things that are actually wrong the first time
 * anyone hits this — the provider is not enabled, or this origin is not a
 * registered platform — because both are console settings and neither produces
 * an error anywhere the person pressing the button can see.
 */
export default function OAuthFailurePage() {
  return (
    <AuthShell
      title="We couldn't finish signing you in"
      description="Google didn't complete the handoff, so no account was created or changed."
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-foreground">
            If this keeps happening
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted">
            <li>Try again — the sign-in window may have been closed early.</li>
            <li>Log in with your email and password instead.</li>
            <li>
              If you run this site: check that Google is enabled under Auth →
              Social providers, and that this domain is registered under Settings
              → Platforms.
            </li>
          </ul>
        </div>

        <LinkButton href="/login" fullWidth>
          Back to log in
        </LinkButton>
      </div>
    </AuthShell>
  );
}
