import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { isAppwriteException } from "@/lib/appwrite/errors";
import { createSessionClient } from "@/lib/appwrite/session";
import { ConflictError, UnauthorizedError } from "@/lib/repositories/errors";
import { consumeToken } from "./tokens";
import type { AuthUser } from "./types";

/**
 * Account operations, behind the same boundary as the repositories: route
 * handlers never touch the Appwrite SDK themselves (CLAUDE.md §5).
 */

function toAuthUser(account: Models.User<Models.Preferences>): AuthUser {
  return {
    id: account.$id,
    email: account.email,
    name: account.name,
    emailVerified: account.emailVerification,
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: AuthUser; session: Models.Session }> {
  let account: Models.User<Models.Preferences>;

  try {
    account = await admin.account.create({
      userId: ID.unique(),
      email: input.email,
      password: input.password,
      name: input.name,
    });
  } catch (error) {
    if (isAppwriteException(error) && error.code === 409) {
      throw new ConflictError("That email already has an account. Log in instead.");
    }
    throw error;
  }

  const session = await admin.account.createEmailPasswordSession({
    email: input.email,
    password: input.password,
  });

  return { user: toAuthUser(account), session };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; session: Models.Session }> {
  let session: Models.Session;

  try {
    session = await admin.account.createEmailPasswordSession({
      email: input.email,
      password: input.password,
    });
  } catch (error) {
    // One message for both an unknown email and a wrong password — anything else
    // tells an attacker which addresses have accounts.
    if (isAppwriteException(error) && (error.code === 401 || error.code === 400)) {
      throw new UnauthorizedError(
        "That email and password don't match. Check them and try again.",
      );
    }
    throw error;
  }

  // Read the profile as the user, not as the key: the admin client has no
  // session, so account.get() on it would not describe this person.
  const account = await createSessionClient(session.secret).account.get();

  return { user: toAuthUser(account), session };
}

/**
 * Turns the `userId` + `secret` Appwrite appends to the OAuth success URL into a
 * session of ours.
 *
 * This is the recipe's `account.createSession`, and it runs **here** rather than
 * in the browser. The whole app authorises off the httpOnly cookie this function's
 * caller writes — proxy.ts, the dashboard layout's `getCurrentUser()`, and
 * `requireUser()` in every route handler all read it. A session created by the
 * Web SDK would live in that SDK's own storage against the Appwrite domain, where
 * none of the three can see it: signed in on the client, signed out everywhere
 * that decides anything.
 *
 * The browser's part is `createOAuth2Token`, which is the half that genuinely has
 * to happen there because it navigates the window.
 */
export async function createOAuthSession(
  input: { userId: string; secret: string },
  userAgent?: string,
): Promise<{ user: AuthUser; session: Models.Session }> {
  const session = await consumeToken(input.userId, input.secret);

  // Same reason as authenticateUser: the admin client has no session, so
  // account.get() on it would not describe this person.
  const account = await createSessionClient(session.secret, userAgent).account.get();

  return { user: toAuthUser(account), session };
}

/**
 * The account behind an address, or null.
 *
 * Only ever called by forgot-password, which must answer identically whether or
 * not it finds one — so this returns null rather than throwing NotFound, to make
 * the "say nothing either way" branch the natural thing to write at the call
 * site rather than something a try/catch has to remember to do.
 */
export async function findUserByEmail(
  email: string,
): Promise<Models.User<Models.Preferences> | null> {
  const { users } = await admin.users.list({
    queries: [Query.equal("email", email), Query.limit(1)],
  });

  return users[0] ?? null;
}

/** Flips `emailVerification` after a confirmation link has been spent. */
export async function markEmailVerified(userId: string): Promise<AuthUser> {
  const account = await admin.users.updateEmailVerification({
    userId,
    emailVerification: true,
  });

  return toAuthUser(account);
}

/**
 * Sets a new password and hands back a fresh session.
 *
 * **Every other session for this user is deleted first, and that is the point of
 * the ordering.** Someone resetting a password is often doing it because someone
 * else has been in the account; leaving that person's session alive would make
 * the reset theatre. The token's own session is among the ones destroyed, which
 * is why a new one is minted at the end rather than reused.
 */
export async function resetPasswordForUser(input: {
  userId: string;
  secret: string;
  password: string;
}): Promise<{ user: AuthUser; session: Models.Session }> {
  const { userId } = input;

  // Validates the link. Throws UnauthorizedError if it is spent or expired, so
  // nothing below runs for a token that was not genuine.
  await consumeToken(userId, input.secret);

  await admin.users.deleteSessions({ userId });

  const account = await admin.users.updatePassword({
    userId,
    password: input.password,
  });

  const session = await admin.account.createEmailPasswordSession({
    email: account.email,
    password: input.password,
  });

  return { user: toAuthUser(account), session };
}

export async function revokeSession(secret: string): Promise<void> {
  try {
    await createSessionClient(secret).account.deleteSession({
      sessionId: "current",
    });
  } catch {
    // An already-expired session is still a successful logout as far as the user
    // is concerned. Clearing the cookie is the part that matters.
  }
}
