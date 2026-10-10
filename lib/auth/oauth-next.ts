import { safeRedirect } from "@/lib/utils/safe-redirect";

/**
 * Where to go after Google sign-in, carried across the trip to Google and back.
 *
 * The success URL Appwrite redirects to is fixed (`/auth/success`), and putting a
 * `?next=` on it would mean registering every variant with the provider. So the
 * destination waits in `sessionStorage`, which is per tab and survives the tab
 * leaving the origin and returning — which is the whole journey here.
 *
 * Read once and cleared, and passed through `safeRedirect` on the way out as
 * well as in, because storage is writable by anything running on the page.
 */

const KEY = "auth:next";

export function rememberOAuthNext(path: string | undefined): void {
  try {
    if (path && path !== "/maps") sessionStorage.setItem(KEY, path);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage refused (a locked-down browser): sign-in still works, and lands on /maps.
  }
}

export function takeOAuthNext(): string {
  try {
    const path = sessionStorage.getItem(KEY) ?? undefined;
    sessionStorage.removeItem(KEY);
    return safeRedirect(path);
  } catch {
    return "/maps";
  }
}
