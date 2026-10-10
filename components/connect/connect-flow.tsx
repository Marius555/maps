"use client";

import { Spinner } from "@heroui/react";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ErrorMessage } from "@/components/ui/error-message";
import { buildReturnUrl, type ConnectedMap } from "@/lib/connect/wordpress";
import { useMe } from "@/lib/query/auth";
import { ApiError } from "@/lib/query/fetcher";
import type { ConnectRequest } from "@/lib/validation/connect.schema";
import { MapChoice } from "./map-choice";
import { ReturningPanel } from "./returning-panel";
import { SignedOutPanel } from "./signed-out-panel";
import { UnconfirmedPanel } from "./unconfirmed-panel";

/**
 * The connect page's states, in the order an owner meets them:
 * signed out → unconfirmed → choosing a map → on the way back to WordPress.
 *
 * Who is signed in comes from `useMe()` — a same-origin `fetch`, which carries
 * the Strict session cookie that the cross-site page request did not. It
 * refetches on focus, which is what moves an unconfirmed owner on once they
 * have opened the confirmation link in another tab.
 */
export function ConnectFlow({
  request,
  selfPath,
}: {
  request: ConnectRequest;
  /** This page, link included — where login and signup send the owner back to. */
  selfPath: string;
}) {
  const me = useMe();
  const [connected, setConnected] = useState<ConnectedMap | null>(null);
  const host = new URL(request.site).host;

  if (connected) {
    return (
      <ReturningPanel
        host={host}
        mapName={connected.name}
        returnUrl={buildReturnUrl(request.return, request, connected)}
      />
    );
  }

  if (me.isPending) {
    return (
      <AuthShell title="Connect your WordPress site">
        <div className="flex justify-center py-2" aria-live="polite">
          <Spinner aria-label="Checking your account" />
        </div>
      </AuthShell>
    );
  }

  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <SignedOutPanel host={host} selfPath={selfPath} />;
    }

    return (
      <AuthShell title="Connect your WordPress site">
        <ErrorMessage error={me.error} />
      </AuthShell>
    );
  }

  const user = me.data.user;

  if (!user.emailVerified) {
    return <UnconfirmedPanel email={user.email} onCheck={() => void me.refetch()} />;
  }

  return (
    <AuthShell
      title="Connect your WordPress site"
      description={`Choose the map to show on ${host}. There's nothing to copy or paste.`}
    >
      <MapChoice
        site={request.site}
        host={host}
        suggestedName={request.title}
        onConnected={setConnected}
      />
    </AuthShell>
  );
}
