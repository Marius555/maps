"use client";

import { Spinner } from "@heroui/react";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";

/**
 * The hop from the provider's billing portal back to Settings → Billing — the
 * same shape as `CheckoutReturn`, and for the same cookie: land outside the
 * proxy, then navigate on from our own page so the Strict cookie is sent.
 *
 * The link is the page's real content; the effect is an optimisation on top of
 * it, so a browser without JavaScript is not stranded.
 */
export function PortalReturn() {
  const router = useRouter();
  const moved = useRef(false);

  useEffect(() => {
    // StrictMode remounts this in development; navigating twice would leave an
    // extra history entry for Back to land on.
    if (moved.current) return;
    moved.current = true;

    router.replace("/settings/billing");
    router.refresh();
  }, [router]);

  return (
    <EmptyState
      icon={CreditCard}
      title="Taking you back"
      description="Your billing settings are opening now."
      action={
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center" aria-live="polite">
            <Spinner aria-label="Opening billing settings" />
          </div>

          <LinkButton href="/settings/billing">Go to billing settings</LinkButton>
        </div>
      }
    />
  );
}
