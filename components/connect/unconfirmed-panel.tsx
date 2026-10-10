"use client";

import { useEffect } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResendLinkButton } from "@/components/verify-email/resend-link-button";

/** How often to ask whether the address has been confirmed meanwhile. */
const CHECK_EVERY_MS = 5_000;

/**
 * A new account has to confirm its address before it can write anything —
 * `withAuth` refuses every non-GET until then — and connecting creates and
 * publishes a map. So this waits, and carries on by itself.
 *
 * `useMe()` already refetches when the tab regains focus, which covers the usual
 * path (the link opens in a new tab, the owner comes back). The interval covers
 * the other one: the mail opened on a phone while this tab sat in view.
 */
export function UnconfirmedPanel({
  email,
  onCheck,
}: {
  email: string;
  onCheck: () => void;
}) {
  useEffect(() => {
    const timer = window.setInterval(onCheck, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [onCheck]);

  return (
    <AuthShell
      title="Check your inbox"
      description={`We sent a confirmation link to ${email}. Open it, and this page carries on by itself.`}
    >
      <ResendLinkButton email={email} size="md" variant="secondary" align="center" />
    </AuthShell>
  );
}
