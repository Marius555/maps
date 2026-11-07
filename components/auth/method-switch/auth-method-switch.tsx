"use client";

import { useState, type ReactNode } from "react";

import { AuthDivider } from "@/components/auth/auth-divider";
import type { AuthView } from "./auth-href";
import { BackToProvidersButton } from "./back-to-providers-button";
import { ContinueWithEmailButton } from "./continue-with-email-button";

/**
 * Log in and Sign up open on Google and GitHub; the email form is one press
 * away, and replaces them rather than unfolding under them.
 *
 * **One view is mounted at a time — conditional rendering, never CSS-hidden.**
 * The signup form's Turnstile widget is rendered by an effect that runs once, on
 * mount, into a container that must already be there (`use-turnstile.ts`). So
 * the email form owns its own hooks and mounts with its fields; hiding it would
 * render the widget into a zero-width box, and hoisting the hook would render it
 * nowhere. Switching back unmounts it, which also removes the widget.
 *
 * **Focus follows a switch and nothing else.** The Email field after "Continue
 * with email", that button again after "Use Google or GitHub instead" — so a
 * keyboard never lands on a control that has just vanished. On page load nothing
 * takes focus, so a phone does not open its keyboard over the page.
 */
export function AuthMethodSwitch({
  initialView,
  providers,
  providersFooter,
  renderEmail,
}: {
  initialView: AuthView;
  /** Google and GitHub. */
  providers: ReactNode;
  /** The line under the switch: the way to the other page. */
  providersFooter: ReactNode;
  /** The email form; `autoFocus` is true only when reached by the switch. */
  renderEmail: (autoFocus: boolean) => ReactNode;
}) {
  const [view, setView] = useState<AuthView>(initialView);
  const [switched, setSwitched] = useState(false);

  function show(next: AuthView) {
    setSwitched(true);
    setView(next);
  }

  if (view === "email") {
    return (
      <div className="space-y-4">
        {renderEmail(switched)}
        <BackToProvidersButton onPress={() => show("providers")} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {providers}

      <AuthDivider />

      <div className="space-y-3">
        <ContinueWithEmailButton autoFocus={switched} onPress={() => show("email")} />
        {providersFooter}
      </div>
    </div>
  );
}
