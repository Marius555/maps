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

/**
 * Proof that *this tab* asked Google to sign it in.
 *
 * `/auth/success?userId=…&secret=…` signs in whoever the token belongs to, and
 * anybody can mint one for their own account. Without this mark, a link to that
 * URL sent to someone else signs *their* browser into the sender's account —
 * login CSRF, and anything they then type lands where the sender can read it.
 * The mark lives in the same per-tab storage as the destination above, so only
 * a sign-in this tab started can finish here.
 *
 * Storage that refuses outright cannot be checked either way, and lets the
 * sign-in through: an attacker cannot make somebody else's storage throw.
 */
const STARTED_KEY = "auth:oauth-started";
const STARTED_TTL_MS = 30 * 60 * 1000;

export function markOAuthStarted(): void {
  try {
    sessionStorage.setItem(STARTED_KEY, String(Date.now()));
  } catch {
    // See above: unreadable storage is waved through on the way back.
  }
}

/**
 * Read without spending it, so StrictMode's second call of a `useState`
 * initializer gets the same answer as the first; `clearOAuthStarted` spends it.
 */
export function oauthStartedHere(): boolean {
  try {
    const stamp = Number(sessionStorage.getItem(STARTED_KEY));
    return stamp > 0 && Date.now() - stamp < STARTED_TTL_MS;
  } catch {
    return true;
  }
}

export function clearOAuthStarted(): void {
  try {
    sessionStorage.removeItem(STARTED_KEY);
  } catch {
    // Nothing to clear in storage that cannot be read.
  }
}
