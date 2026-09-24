import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin, createSessionIssuer } from "@/lib/appwrite/admin";
import { isAppwriteException } from "@/lib/appwrite/errors";
import { createSessionClient } from "@/lib/appwrite/session";
import { ConflictError, UnauthorizedError } from "@/lib/repositories/errors";
import { readsAsVerified } from "./email-gate";
import { readSessionSecret } from "./session-cookie";
import { revokeOtherSessions } from "./sessions";
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
    emailVerified: readsAsVerified(account.emailVerification),
  };
}

/**
 * **The address has already been judged by the time it gets here.** Whether it is
 * a throwaway, and whether its domain receives mail at all, are decided by
 * `signupServerSchema` — because those checks belong to a 422 with a sentence
 * under the Email field, not to a thrown repository error. Said here because it
 * is invisible from this file: nothing below would tell you the rule exists.
 */
export async function registerUser(
  input: {
    name: string;
    email: string;
    password: string;
  },
  userAgent?: string,
): Promise<{ user: AuthUser; session: Models.Session }> {
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

  const session = await createSessionIssuer(userAgent).createEmailPasswordSession({
    email: input.email,
    password: input.password,
  });

  return { user: toAuthUser(account), session };
}

export async function authenticateUser(
  input: {
    email: string;
    password: string;
  },
  userAgent?: string,
): Promise<{ user: AuthUser; session: Models.Session }> {
  let session: Models.Session;

  try {
    session = await createSessionIssuer(userAgent).createEmailPasswordSession({
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
  const session = await consumeToken(input.userId, input.secret, userAgent);

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
export async function resetPasswordForUser(
  input: {
    userId: string;
    secret: string;
    password: string;
  },
  userAgent?: string,
): Promise<{ user: AuthUser; session: Models.Session }> {
  const { userId } = input;

  // Validates the link. Throws UnauthorizedError if it is spent or expired, so
  // nothing below runs for a token that was not genuine.
  await consumeToken(userId, input.secret);

  await admin.users.deleteSessions({ userId });

  const account = await admin.users.updatePassword({
    userId,
    password: input.password,
  });

  const session = await createSessionIssuer(userAgent).createEmailPasswordSession({
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

/** The name on the account, as the person wants to be addressed. */
export async function updateUserName(userId: string, name: string): Promise<AuthUser> {
  const account = await admin.users.updateName({ userId, name });

  return toAuthUser(account);
}

/**
 * Whether the account has a password at all.
 *
 * An account made by Google sign-in has none — Appwrite leaves `passwordUpdate`
 * empty for it — and that is the same field Appwrite's own `updatePassword`
 * consults before demanding the old one. The Account page shows the Password
 * section only when this is true, and the password route refuses otherwise —
 * with no old password to demand, Appwrite would set one unchecked.
 *
 * Read on its own rather than added to `AuthUser`: only the Account page and
 * the password route need it, and `AuthUser` is resolved on every request.
 */
export async function accountHasPassword(userId: string): Promise<boolean> {
  const user = await admin.users.get({ userId });

  return Boolean(user.passwordUpdate);
}

/**
 * The current password was wrong. Thrown so the route can put the message
 * under that one field rather than at the top of the form.
 */
export class WrongPasswordError extends Error {
  constructor() {
    super("That isn't your current password. Check it and try again.");
    this.name = "WrongPasswordError";
  }
}

/** Appwrite refused the new password under one of the project's password rules. */
export class PasswordRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordRefusedError";
  }
}

/**
 * Sets a new password as the signed-in user, then signs out every other device.
 *
 * **As the user, not with the key**, for the whole of this call's value: the
 * session client makes Appwrite check `oldPassword` itself. The admin client's
 * `users.updatePassword` checks nothing, so a stolen session could use it to
 * lock the owner out.
 *
 * **Every other session goes afterwards**, for the reason reset does it:
 * somebody changing a password is often doing it because somebody else has been
 * in the account. This session survives, so the person pressing Save stays signed
 * in. Removing the others is best effort. The password has already changed, and
 * saying it failed would be untrue.
 */
export async function changePassword(input: {
  password: string;
  currentPassword: string;
}): Promise<void> {
  const secret = await readSessionSecret();
  if (!secret) throw new UnauthorizedError();

  try {
    await createSessionClient(secret).account.updatePassword({
      password: input.password,
      oldPassword: input.currentPassword,
    });
  } catch (error) {
    if (isAppwriteException(error)) {
      if (error.code === 401) throw new WrongPasswordError();
      if (error.type === "password_recently_used") {
        throw new PasswordRefusedError(
          "You've used that password before on this account. Choose a new one.",
        );
      }
      if (error.type === "password_personal_data") {
        throw new PasswordRefusedError(
          "Leave your name and email out of the password, and try again.",
        );
      }
      if (error.code === 400) {
        throw new PasswordRefusedError(
          "That password isn't allowed. Choose a longer or less common one.",
        );
      }
    }
    throw error;
  }

  try {
    await revokeOtherSessions();
  } catch (error) {
    console.error("Changed the password but couldn't sign out the other sessions:", error);
  }
}

/**
 * Deletes the login itself: the last step of deleting an account, after every
 * row and file the account owned is gone (`lib/account-deletion`).
 *
 * Appwrite ends the user's sessions along with it. Last because it cannot be
 * undone and cannot be retried: once it is gone, nobody is left to be signed in
 * as and finish the job.
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    await admin.users.delete({ userId });
  } catch (error) {
    // Already gone is the outcome that was asked for, so a retried final step
    // succeeds.
    if (isAppwriteException(error) && error.code === 404) return;
    throw error;
  }
}

/**
 * The confirmation that opens the deletion steps, kept on the Appwrite user.
 *
 * `POST /api/account/deletion` checks the typed address, cancels the
 * subscription and stamps this; every `…/deletion/step` refuses without a
 * recent one. Without it the step route would delete a whole account on a bare
 * POST, with no confirmation behind it. A timestamp on the user rather than a
 * signed token, because it needs no new secret, and it disappears with the user
 * at the end.
 *
 * Merged into the existing prefs rather than written over them: `updatePrefs`
 * replaces the whole object.
 */
const DELETION_PREF = "deletionStartedAt";

export async function markDeletionStarted(userId: string): Promise<void> {
  const prefs = await admin.users.getPrefs({ userId });

  await admin.users.updatePrefs({
    userId,
    prefs: { ...prefs, [DELETION_PREF]: new Date().toISOString() },
  });
}

/** When the deletion was confirmed, or null if it never was. */
export async function deletionStartedAt(userId: string): Promise<string | null> {
  const prefs: Record<string, unknown> = await admin.users.getPrefs({ userId });
  const value = prefs[DELETION_PREF];

  return typeof value === "string" ? value : null;
}
