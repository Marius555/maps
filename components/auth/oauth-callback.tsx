"use client";

import { Spinner } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ErrorMessage } from "@/components/ui/error-message";
import { LinkButton } from "@/components/ui/link-button";
import { exchangeOAuthToken } from "@/lib/query/auth";
import { queryKeys } from "@/lib/query/keys";

/**
 * The second half of Google sign-in: turn the callback's `userId` + `secret`
 * into our own session cookie, then get out of the way.
 *
 * **The exchange is a POST to our origin, not a Web SDK call.** Only our server
 * can write the httpOnly cookie that `proxy.ts`, the dashboard layout and every
 * `withAuth` handler read; a session created by the SDK would live against the
 * Appwrite domain where none of them can see it. See
 * `app/api/auth/oauth/session/route.ts`.
 *
 * **The credentials are captured once, in a lazy `useState`, and that is
 * load-bearing rather than tidy.** The effect scrubs them out of the address bar
 * with `replaceState`, so a component that re-read `useSearchParams()` on any
 * later render would find them gone and flip itself into the "incomplete link"
 * state on top of a sign-in that was working. Reading once at mount makes the
 * scrub invisible to the render.
 *
 * **The outcome is this component's own state, not a mutation's.** See
 * `exchangeOAuthToken` for the bug that decided it — a `useMutation` fired from
 * an effect loses its result to StrictMode's simulated remount, and the page
 * hangs on the pending state forever. Local state lives on the fiber, which
 * survives that remount, so the `ref` guard below and the state agree about
 * what has already happened.
 */
export function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const started = useRef(false);

  const [credentials] = useState(() => ({
    userId: searchParams.get("userId"),
    secret: searchParams.get("secret"),
  }));

  const [failure, setFailure] = useState<unknown>(null);

  const missing = !credentials.userId || !credentials.secret;

  useEffect(() => {
    if (started.current || missing) return;
    started.current = true;

    /**
     * The secret is a live credential sitting in the address bar, and from there
     * it reaches the history entry, the `Referer` of the next request, and any
     * screenshot of a browser mid-sign-in. `replaceState` adds no history entry,
     * so Back still leaves this page rather than replaying a spent token.
     */
    window.history.replaceState(null, "", window.location.pathname);

    exchangeOAuthToken({
      userId: credentials.userId!,
      secret: credentials.secret!,
    })
      .then(({ user }) => {
        queryClient.setQueryData(queryKeys.me, { user });
        router.replace("/maps");
        // The dashboard is server-rendered, so the new cookie has to reach the
        // server before the redirect paints — same reason as the login form.
        router.refresh();
      })
      .catch((error: unknown) => {
        // Not a setState in the effect body: this runs a network round trip
        // later, off the promise, which is the callback the lint rule points at
        // as the correct place for it.
        setFailure(error);
      });
    // Once, on mount. The ref is what enforces that; the dependency list is kept
    // empty so a stable-identity change cannot re-run a one-shot token exchange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!missing && !failure) {
    return (
      <AuthShell title="Signing you in" description="One moment — finishing up with Google.">
        <div className="flex justify-center py-2" aria-live="polite">
          <Spinner aria-label="Signing you in" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="We couldn't finish signing you in"
      description="Nothing was changed on your account. Try again from the log in page."
    >
      <div className="space-y-5">
        <ErrorMessage
          error={
            missing
              ? "That sign-in link is incomplete. Start again from the log in page."
              : failure
          }
        />

        <LinkButton href="/login" fullWidth>
          Back to log in
        </LinkButton>
      </div>
    </AuthShell>
  );
}
