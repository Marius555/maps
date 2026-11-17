"use client";

import { buttonVariants, Spinner } from "@heroui/react";
import { CircleCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { track } from "@/lib/posthog/client";

/** The route handler that 307s on to the buyer's last map. */
const CONTINUE_URL = "/api/checkout/return";

/**
 * The hop from the provider's domain back into the dashboard.
 *
 * **This component exists because of one cookie attribute.** The session cookie
 * is `sameSite: "strict"`, and a browser returning from `checkout.stripe.com` is
 * making a cross-site top-level navigation — so it withholds the cookie, and
 * carries that classification through any server redirect chain. Sending the
 * buyer straight to the dashboard therefore handed `proxy.ts` a request with no
 * cookie on it and bounced somebody who had just paid us onto the login page.
 *
 * `components/auth/oauth-callback.tsx` exists for the identical reason and
 * `docs/notes/auth.md` has the post-mortem. The shape is the same: land on a
 * page **outside `proxy.ts`'s matcher**, which renders whatever cookie is
 * visible, then navigate on from here — because a navigation our own same-site
 * page initiates does carry a Strict cookie.
 *
 * **A document navigation to a route handler, never `router.replace("/maps")`.**
 * It used to be the latter, and a soft navigation paints the destination's
 * `loading.tsx` at once: the buyer saw the maps-list skeleton, then the list
 * page's `redirect()` (thrown after that shell had flushed, so a client
 * redirect) moved them on to the editor. `/api/checkout/return` answers with a
 * real 307 to the last map, so the next thing painted is the editor, where
 * `PurchaseCelebration` opens on `?checkout=done` and waits for the webhook if
 * the plan has not landed yet. `replace`, so Back does not return here.
 *
 * **The link is not a fallback afterthought.** With JavaScript off the effect
 * never runs, and an auto-navigation alone would strand a paying customer on a
 * dead end. A plain `<a>`, not `LinkButton`: `next/link` would try to
 * soft-navigate to a route handler.
 */
export function CheckoutReturn() {
  const moved = useRef(false);

  useEffect(() => {
    // StrictMode remounts this in development; one navigation is enough.
    if (moved.current) return;
    moved.current = true;

    track("checkout_completed");
    window.location.replace(CONTINUE_URL);
  }, []);

  return (
    <EmptyState
      icon={CircleCheck}
      title="Payment received"
      description="Thank you — opening your map now."
      action={
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center" aria-live="polite">
            <Spinner aria-label="Opening your map" />
          </div>

          <a className={buttonVariants()} href={CONTINUE_URL}>
            Go to your map
          </a>
        </div>
      }
    />
  );
}
