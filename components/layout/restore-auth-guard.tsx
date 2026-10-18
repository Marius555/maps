"use client";

import { useEffect } from "react";

/**
 * Sends a dashboard page the browser restored from the bfcache to `/login` if
 * the session behind it has ended — a sign-out, or a deleted account.
 *
 * A restore makes no request, so none of the three guards on the request path
 * (`proxy.ts`, the dashboard layout, `requireUser()`) sees it. This asks once,
 * and only on a restore. **A signed-in restore is left exactly as it was**:
 * these pages are kept bfcache-eligible on purpose (`lib/stores/import-persist.ts`),
 * and an unconditional reload would spend that.
 *
 * It replaced `Clear-Site-Data: "cache"` on the logout response, which Chrome
 * holds the response for until its whole disk cache is walked — about 20 seconds
 * of "Log out does nothing" in production. `docs/notes/auth.md`.
 */
export function RestoreAuthGuard() {
  useEffect(() => {
    const onPageShow = async (event: PageTransitionEvent) => {
      if (!event.persisted) return;

      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (response.status === 401) window.location.replace("/login");
      } catch {
        // Offline is not signed out. The next request meets the real guards.
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
