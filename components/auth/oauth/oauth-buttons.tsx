"use client";

import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { startOAuthSignIn } from "@/lib/appwrite/browser";
import { markOAuthStarted, rememberOAuthNext } from "@/lib/auth/oauth-next";
import {
  OAUTH_PROVIDER_LABEL,
  OAUTH_PROVIDERS,
  type OAuthProviderId,
} from "@/lib/auth/oauth-providers";
import { OAuthButton } from "./oauth-button";

/**
 * Google and GitHub sign-in, first half — the same words on `/login` and
 * `/signup`, because the first press makes the account either way.
 *
 * **`createOAuth2Token`, never `createOAuth2Session`.** The session variant tells
 * Appwrite to set its own cookie on its own domain, which our server cannot read
 * — `proxy.ts`, the dashboard layout and every `withAuth` handler all authorise
 * off the httpOnly cookie *we* write. The token variant hands the secret back to
 * us at the callback instead, and `/auth/success` posts it to our own origin so
 * the session is created where the rest of the app can see it.
 *
 * **`createOAuth2Token` is synchronous and navigates.** Its type in the SDK is
 * `void | string`: it assigns `window.location.href` and the browser leaves. It
 * is not awaited here because there is nothing to await, and nothing may be
 * scheduled after it — which is why `setPending(null)` never runs on the happy
 * path. The pending state is ended by the page being replaced, and while it
 * lasts the other button is disabled, so two navigations cannot race.
 *
 * The SDK call itself lives in `lib/appwrite/browser.ts`, not here:
 * `eslint.config.mjs` forbids `components/**` from importing the Appwrite SDK at
 * all (CLAUDE.md §5), and that boundary is worth more than the one import it
 * costs. `window.location.origin` is read inside the handler rather than at
 * module scope, so this component still renders on the server.
 */
export function OAuthButtons({
  redirectTo,
}: {
  /** Where to land after the provider, instead of `/maps` — `lib/auth/oauth-next.ts`. */
  redirectTo?: string;
}) {
  const [pending, setPending] = useState<OAuthProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  function signIn(provider: OAuthProviderId) {
    setError(null);
    setPending(provider);

    try {
      rememberOAuthNext(redirectTo);
      markOAuthStarted();
      startOAuthSignIn(provider, window.location.origin);
    } catch {
      // Reached only if the SDK refuses before navigating — a misconfigured
      // endpoint, say. A silent dead button is the worst outcome here, so it
      // always ends up saying something.
      setPending(null);
      setError(
        `We couldn't reach ${OAUTH_PROVIDER_LABEL[provider]} just now. Try again, or continue with email below.`,
      );
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorMessage error={error} /> : null}

      {OAUTH_PROVIDERS.map((provider) => (
        <OAuthButton
          key={provider}
          provider={provider}
          isPending={pending === provider}
          isDisabled={pending !== null && pending !== provider}
          onPress={() => signIn(provider)}
        />
      ))}
    </div>
  );
}
