import "server-only";

import { cookies } from "next/headers";
import type { Models } from "node-appwrite";

import { SESSION_COOKIE } from "@/lib/appwrite/config";

export async function readSessionSecret(): Promise<string | null> {
  // cookies() is async in Next 16 — the synchronous form was removed.
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(session: Models.Session): Promise<void> {
  const jar = await cookies();

  jar.set(SESSION_COOKIE, session.secret, {
    httpOnly: true,
    // `secure: true` over plain http://localhost makes the browser discard the
    // cookie silently: login appears to succeed and never persists.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(session.expire),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
