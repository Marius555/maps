import "server-only";

import { cache } from "react";

import { isUnauthorized } from "@/lib/appwrite/errors";
import { createSessionClient } from "@/lib/appwrite/session";
import { UnauthorizedError } from "@/lib/repositories/errors";
import { readsAsVerified } from "./email-gate";
import { forgetSession, readCachedUser, rememberUser } from "./identity-cache";
import { readSessionSecret } from "./session-cookie";
import type { AuthUser } from "./types";

/**
 * The data access layer for identity. Every route handler and every protected
 * page resolves the caller through here — proxy.ts does not authorize anything.
 *
 * Two layers of memory in front of `account.get()`:
 * - React `cache()`, so a layout and the page beneath it share one answer per
 *   request.
 * - `identity-cache.ts`, so the next request with the same secret within a
 *   minute does not ask Appwrite again. A sidebar navigation re-renders the page,
 *   not the layout, and used to pay a serial round trip before any of the page's
 *   own reads could start. Read that file before relying on how fresh this is.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const secret = await readSessionSecret();
  if (!secret) return null;

  const cached = readCachedUser(secret);
  if (cached) return cached;

  try {
    const account = await createSessionClient(secret).account.get();

    const user: AuthUser = {
      id: account.$id,
      email: account.email,
      name: account.name,
      emailVerified: readsAsVerified(account.emailVerification),
    };
    rememberUser(secret, user);

    return user;
  } catch (error) {
    // An expired, revoked or forged cookie is a logged-out user, not a crash.
    //
    // We can't clear the stale cookie here: Next 16 forbids writing cookies
    // during a Server Component render. It gets overwritten on the next login
    // and cleared by POST /api/auth/logout. A stale cookie grants nothing.
    if (isUnauthorized(error)) {
      forgetSession(secret);
      return null;
    }
    throw error;
  }
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
