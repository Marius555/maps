import type { Metadata } from "next";
import { Suspense } from "react";

import { OAuthCallback } from "@/components/auth/oauth-callback";

export const metadata: Metadata = {
  title: "Signing you in",
  // Nothing here is worth indexing and every URL of it carries a secret.
  robots: { index: false, follow: false },
};

/**
 * Where Appwrite sends the browser after Google says yes.
 *
 * A page rather than a route handler, and that is the SameSite decision made
 * visible. The session cookie is `sameSite: "strict"`, and this navigation
 * arrives from Appwrite's domain — a classification browsers carry through a
 * server redirect chain. A handler that set the cookie and redirected to `/maps`
 * would hand `proxy.ts` a request with no cookie on it and bounce a user who has
 * just successfully signed in.
 *
 * From a page, the exchange is a same-origin `fetch` and the hop to `/maps` is a
 * client navigation this page initiates, so both carry the cookie. It also keeps
 * `/auth/success` outside the proxy's matcher, which it has to be — nobody is
 * signed in when they land here.
 */
export default function OAuthSuccessPage() {
  /*
   * The Suspense boundary is required, not decorative: `OAuthCallback` reads
   * `useSearchParams()`, and Next refuses to prerender a page that does so
   * without one. Its fallback is deliberately the same "signing you in" shape
   * the component's own pending state uses, so the hand-off between them is not
   * a visible flash of different chrome.
   */
  return (
    <Suspense fallback={<OAuthCallbackFallback />}>
      <OAuthCallback />
    </Suspense>
  );
}

function OAuthCallbackFallback() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Signing you in
        </h1>
        <p className="text-sm text-muted">One moment — finishing up with Google.</p>
      </div>
    </div>
  );
}
