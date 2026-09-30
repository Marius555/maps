import "server-only";

import { cookies } from "next/headers";

import { ADMIN_SESSION_TTL_MS } from "./session";

/**
 * The admin cookie. **Not the customer session** — `a_session_<project>` is an
 * Appwrite session and belongs to `lib/auth`; this one is ours alone, signed by
 * `session.ts`, and nothing in `lib/auth` reads it or is read by it. A customer
 * signed in on the same browser is unaffected either way.
 *
 * `__Host-` in production: the browser then refuses it unless it is Secure,
 * host-only and `path=/`, so no subdomain can plant or shadow it. The prefix
 * needs Secure, which plain-http development cannot give, hence the bare name
 * there.
 */
const PRODUCTION = process.env.NODE_ENV === "production";

export const ADMIN_COOKIE = PRODUCTION ? "__Host-admin_session" : "admin_session";

export async function readAdminCookie(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_COOKIE)?.value;
}

export async function setAdminCookie(token: string): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: PRODUCTION,
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/" });
}
