import "server-only";

import { cache } from "react";

import { isUnauthorized } from "@/lib/appwrite/errors";
import { createSessionClient } from "@/lib/appwrite/session";
import { UnauthorizedError } from "@/lib/repositories/errors";
import { readSessionSecret } from "./session-cookie";
import type { AuthUser } from "./types";

/**
 * The data access layer for identity. Every route handler and every protected
 * layout resolves the caller through here — proxy.ts does not authorize anything.
 *
 * Wrapped in React `cache()` so a layout and the page beneath it share a single
 * `account.get()` per request.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const secret = await readSessionSecret();
  if (!secret) return null;

  try {
    const account = await createSessionClient(secret).account.get();

    return {
      id: account.$id,
      email: account.email,
      name: account.name,
      emailVerified: account.emailVerification,
    };
  } catch (error) {
    // An expired, revoked or forged cookie is a logged-out user, not a crash.
    //
    // We can't clear the stale cookie here: Next 16 forbids writing cookies
    // during a Server Component render. It gets overwritten on the next login
    // and cleared by POST /api/auth/logout. A stale cookie grants nothing.
    if (isUnauthorized(error)) return null;
    throw error;
  }
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
