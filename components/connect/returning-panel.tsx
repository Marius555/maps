"use client";

import { Spinner } from "@heroui/react";
import { useEffect, useRef } from "react";

import { AuthShell } from "@/components/auth/auth-shell";

/**
 * Connected: back to wp-admin, where the plugin stores the answer.
 *
 * `replace`, so Back from WordPress does not land on a connect page whose work
 * is done. The link is the real content and the effect an optimisation on top,
 * the same as `CheckoutReturn` — with scripts stalled, the owner still has a way
 * home.
 */
export function ReturningPanel({
  host,
  mapName,
  returnUrl,
}: {
  host: string;
  mapName: string;
  returnUrl: string;
}) {
  const moved = useRef(false);

  useEffect(() => {
    // StrictMode mounts twice in development.
    if (moved.current) return;
    moved.current = true;
    window.location.replace(returnUrl);
  }, [returnUrl]);

  return (
    <AuthShell
      title="Connected"
      description={`${mapName} will show on ${host}. Taking you back to WordPress now.`}
    >
      <div className="flex flex-col items-center gap-4">
        <div aria-live="polite">
          <Spinner aria-label="Going back to WordPress" />
        </div>
        <a href={returnUrl} className="text-sm text-foreground underline">
          Back to WordPress
        </a>
      </div>
    </AuthShell>
  );
}
