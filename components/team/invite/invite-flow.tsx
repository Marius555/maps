"use client";

import { Spinner } from "@heroui/react";

import { AuthShell } from "@/components/auth/auth-shell";
import { UnconfirmedPanel } from "@/components/connect/unconfirmed-panel";
import { ErrorMessage } from "@/components/ui/error-message";
import { useMe } from "@/lib/query/auth";
import { ApiError } from "@/lib/query/fetcher";
import type { MemberRole } from "@/lib/team/roles";
import { InviteDecision } from "./invite-decision";
import { InviteMismatchPanel } from "./invite-mismatch-panel";
import { InviteSignedOutPanel } from "./invite-signed-out-panel";

/**
 * The invite page's states, in the order an invitee meets them:
 * signed out → signed in as somebody else → unconfirmed → join or decline.
 *
 * Who is signed in comes from `useMe()` — a same-origin `fetch`, which carries
 * the Strict session cookie the cross-site page request did not. It refetches on
 * focus, which is what moves a new account on once its address is confirmed in
 * another tab. The model is `components/connect/connect-flow.tsx`.
 */
export function InviteFlow({
  token,
  email,
  role,
  teamName,
  inviterName,
}: {
  token: string;
  email: string;
  role: MemberRole;
  teamName: string;
  inviterName: string;
}) {
  const me = useMe();
  const title = teamName ? `Join ${teamName}'s team` : "Join the team";

  if (me.isPending) {
    return (
      <AuthShell title={title}>
        <div className="flex justify-center py-2" aria-live="polite">
          <Spinner aria-label="Checking your account" />
        </div>
      </AuthShell>
    );
  }

  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <InviteSignedOutPanel title={title} email={email} selfPath={`/invite/${token}`} />;
    }

    return (
      <AuthShell title={title}>
        <ErrorMessage error={me.error} />
      </AuthShell>
    );
  }

  const user = me.data.user;

  if (user.email.trim().toLowerCase() !== email) {
    return <InviteMismatchPanel invitedEmail={email} signedInEmail={user.email} />;
  }

  if (!user.emailVerified) {
    return <UnconfirmedPanel email={user.email} onCheck={() => void me.refetch()} />;
  }

  return (
    <InviteDecision
      token={token}
      title={title}
      role={role}
      inviterName={inviterName}
    />
  );
}
