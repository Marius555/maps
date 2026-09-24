"use client";

import { Spinner } from "@heroui/react";
import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";

/**
 * The hop from the provider's domain back into the dashboard.
 *
 * **This component exists because of one cookie attribute.** The session cookie
 * is `sameSite: "strict"`, and a browser returning from `lemonsqueezy.com` is
 * making a cross-site top-level navigation — so it withholds the cookie, and
 * carries that classification through any server redirect chain. Sending the
 * buyer straight to the dashboard therefore handed `proxy.ts` a request with no
 * cookie on it and bounced somebody who had just paid us onto the login page.
 *
 * `components/auth/oauth-callback.tsx` exists for the identical reason and
 * `docs/notes/auth.md` has the post-mortem; this is the third arrival from
 * off-site in the app and the last one to get the fix. The shape is the same:
 * land on a page **outside `proxy.ts`'s matcher**, which renders whatever cookie
 * is visible, then navigate on from here — because a navigation our own
 * same-site page initiates does carry a Strict cookie.
 *
 * `router.refresh()` after the `replace` is load bearing, not belt and braces:
 * `/settings/billing` is server-rendered, so the cookie has to reach the *server* before
 * the destination paints.
 *
 * **The link is not a fallback afterthought.** With JavaScript off the effect
 * never runs, and an auto-navigation alone would strand a paying customer on a
 * dead end. The link is the page's real content; the effect is an optimisation
 * on top of it.
 */
export function CheckoutReturn() {
  const router = useRouter();
  const moved = useRef(false);

  useEffect(() => {
    // StrictMode remounts this in development, and navigating twice would push
    // a second entry that Back lands on.
    if (moved.current) return;
    moved.current = true;

    router.replace("/settings/billing?checkout=done");
    router.refresh();
  }, [router]);

  return (
    <EmptyState
      icon={CircleCheck}
      title="Payment received"
      description="Thank you — taking you to your account now."
      action={
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center" aria-live="polite">
            <Spinner aria-label="Opening your account" />
          </div>

          <LinkButton href="/settings/billing">Go to your account</LinkButton>
        </div>
      }
    />
  );
}
