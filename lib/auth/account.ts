import "server-only";

import { ID, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { isAppwriteException } from "@/lib/appwrite/errors";
import { createSessionClient } from "@/lib/appwrite/session";
import { ConflictError, UnauthorizedError } from "@/lib/repositories/errors";
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
