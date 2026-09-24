import "server-only";

import type { Models } from "node-appwrite";

import { isAppwriteException } from "@/lib/appwrite/errors";
import { createSessionClient } from "@/lib/appwrite/session";
import { NotFoundError, UnauthorizedError } from "@/lib/repositories/errors";
import { readSessionSecret } from "./session-cookie";

/**
 * The devices signed in to this account, and ending them.
 *
 * Every call goes through the **session** client, as the person, never the key:
 * Appwrite then scopes the list and the deletes to their own account by itself,
 * and a session id from somebody else's account is simply not found. The secret
 * is read here, from the cookie, and never handed out — it stays inside
 * `lib/auth` like everywhere else.
 *
 * What a row can say comes from the user agent recorded when the session was
 * created. Every place this app creates one forwards the browser's
 * (`createSessionIssuer`), which is why this list is worth showing at all.
 * Sessions created before that shipped read "Unknown device", and age out.
 *
 * **No location.** Appwrite records the IP the session was created from, and
 * that is always our server, since sessions are created server-side. A country
 * that is the host's for every row would be worse than none.
 */

export type AccountSession = {
  id: string;
  current: boolean;
  /** "Chrome 131", or null when Appwrite could not tell. */
  client: string | null;
  /** "Windows 11", "iOS 18", or null. */
  os: string | null;
  /** "Apple iPhone" for a phone, null for a desktop. */
  device: string | null;
  /** How this session signed in: "email", "google", "token"… */
  provider: string;
  createdAt: string;
};

async function sessionAccount() {
  const secret = await readSessionSecret();
  if (!secret) throw new UnauthorizedError();

  return createSessionClient(secret).account;
}

function joined(...parts: string[]): string | null {
  const text = parts.map((part) => part.trim()).filter(Boolean).join(" ");

  return text || null;
}

function toAccountSession(session: Models.Session): AccountSession {
  const device = joined(session.deviceBrand, session.deviceModel);

  return {
    id: session.$id,
    current: session.current,
    client: joined(session.clientName, session.clientVersion.split(".")[0] ?? ""),
    os: joined(session.osName, session.osVersion),
    device: device && session.deviceName !== "desktop" ? device : null,
    provider: session.provider,
    createdAt: session.$createdAt,
  };
}

/** This device first, then newest first. */
export async function listAccountSessions(): Promise<AccountSession[]> {
  const { sessions } = await (await sessionAccount()).listSessions();

  return sessions
    .map(toAccountSession)
    .sort((a, b) =>
      a.current === b.current
        ? b.createdAt.localeCompare(a.createdAt)
        : a.current
          ? -1
          : 1,
    );
}

/**
 * Signs one other device out.
 *
 * Not this one: that is Log out, which also clears the cookie and the page
 * cache, and a delete here would leave a dead cookie behind.
 */
export async function revokeAccountSession(sessionId: string): Promise<void> {
  const account = await sessionAccount();
  const { sessions } = await account.listSessions();
  const target = sessions.find((session) => session.$id === sessionId);

  if (!target) throw new NotFoundError("That device is already signed out.");
  if (target.current) {
    throw new NotFoundError("That's this device. Use Log out to sign out of it.");
  }

  try {
    await account.deleteSession({ sessionId });
  } catch (error) {
    // Expired between the list and the delete: signed out is signed out.
    if (isAppwriteException(error) && error.code === 404) return;
    throw error;
  }
}

/** Every device but this one. Returns how many were signed out. */
export async function revokeOtherSessions(): Promise<number> {
  const account = await sessionAccount();
  const { sessions } = await account.listSessions();
  const others = sessions.filter((session) => !session.current);

  const results = await Promise.allSettled(
    others.map((session) => account.deleteSession({ sessionId: session.$id })),
  );

  const failed = results.filter(
    (result) =>
      result.status === "rejected" &&
      !(isAppwriteException(result.reason) && result.reason.code === 404),
  );

  if (failed.length > 0) {
    console.error("Couldn't sign out every other session:", failed);
    throw new Error("Some sessions could not be signed out.");
  }

  return others.length;
}
