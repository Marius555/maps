"use client";

import { useEffect } from "react";

/**
 * Reloads a console page the browser restored from the bfcache, so
 * `requireAdminPage()` answers it — after a sign-out, with `/login/admin`.
 *
 * Unconditional, unlike the customer shell's `RestoreAuthGuard`: the console
 * has no state worth keeping across a restore and no endpoint cheaper than the
 * page itself to ask. It replaced `Clear-Site-Data: "cache"` on the logout
 * response, which made Chrome hold sign-out for ~20 seconds.
 */
export function AdminRestoreGuard() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
