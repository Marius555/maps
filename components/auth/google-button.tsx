"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { startGoogleSignIn } from "@/lib/appwrite/browser";

/**
 * Google sign-in, first half.
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
 * scheduled after it — which is why `setBusy(false)` never runs on the happy
 * path. The pending state is ended by the page being replaced.
 *
 * The SDK call itself lives in `lib/appwrite/browser.ts`, not here:
 * `eslint.config.mjs` forbids `components/**` from importing the Appwrite SDK at
 * all (CLAUDE.md §5), and that boundary is worth more than the one import it
 * costs. `window.location.origin` is read inside the handler rather than at
 * module scope, so this component still renders on the server.
 */
export function GoogleButton({ label = "Sign in with Google" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function signIn() {
    setError(null);
    setBusy(true);

    try {
      startGoogleSignIn(window.location.origin);
    } catch {
      // Reached only if the SDK refuses before navigating — a misconfigured
      // endpoint, say. A silent dead button is the worst outcome here, so it
      // always ends up saying something.
      setBusy(false);
      setError("We couldn't reach Google just now. Try again, or use your email below.");
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorMessage error={error} /> : null}

      {/*
        `outline` rather than `secondary`, and this was measured rather than
        chosen: HeroUI's `secondary` sets `--button-fg` to
        `--accent-soft-foreground`, so the label *and* the mark came out in our
        own brand orange — a Google button drawn in somebody else's colour.
        `outline` is `--default-foreground` on a bordered transparent ground,
        which is both the conventional treatment for this button and the one
        that makes `currentColor` on the mark resolve to a neutral.

        Not `primary`: that is the accent fill the Log in button below already
        wears, and two accent-filled buttons on a 384px column leaves neither
        of them reading as the main action.
      */}
      <Button
        type="button"
        variant="outline"
        fullWidth
        isPending={busy}
        onPress={signIn}
      >
        <GoogleMark />
        {label}
      </Button>
    </div>
  );
}

/**
 * `currentColor`, not the `#C4C6D7` the mark ships with: that grey sits at about
 * 78% lightness and all but disappears on the light theme's white button. One
 * asset, correct on both grounds.
 */
function GoogleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.7034 7.91133C14.7554 7.02509 13.4903 6.54228 12.1813 6.56212C9.78605 6.56212 7.75176 8.14611 7.02642 10.279V10.2791C6.64183 11.3968 6.64183 12.6071 7.02642 13.7249H7.02979C7.75849 15.8545 9.78941 17.4385 12.1847 17.4385C13.4211 17.4385 14.4826 17.1285 15.3053 16.5809V16.5787C16.2735 15.9504 16.9348 14.9616 17.1406 13.8439H12.1813V10.3783H20.8414C20.9494 10.9802 21 11.5952 21 12.207C21 14.9443 20.002 17.2586 18.2655 18.826L18.2673 18.8274C16.7458 20.203 14.6576 21 12.1813 21C8.70985 21 5.53527 19.082 3.97666 16.043V16.043C2.67445 13.5 2.67445 10.5039 3.97666 7.96096H3.97668L3.97666 7.96094C5.53527 4.9186 8.70985 3.00061 12.1813 3.00061C14.4619 2.97415 16.6649 3.8141 18.3247 5.34188L15.7034 7.91133Z"
        fill="currentColor"
      />
    </svg>
  );
}
