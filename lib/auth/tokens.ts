import "server-only";

import type { Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { isAppwriteException } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { UnauthorizedError } from "@/lib/repositories/errors";

/**
 * The secrets behind every emailed link.
 *
 * **Appwrite's tokens, not ours.** `users.createToken` stores a single-use,
 * expiring secret and `account.createSession` is what redeems it — the same pair
 * the Google flow uses. Minting our own HMAC would have meant a signing secret to
 * add to the environment, an expiry to enforce by hand, and a way to make a token
 * single-use, which needs somewhere to write that it has been spent. This needs
 * none of the three, and no schema change (CLAUDE.md §6).
 *
 * The consequence to keep in view: **redeeming a token creates a real session.**
 * That is not a side effect to be tidied away, it is the only way to validate
 * one, so every caller of `consumeToken` has to decide what happens to the
 * session it hands back. Verification keeps it and signs the user in; the
 * password reset throws away every session that user has, including this one.
 */

/**
 * 24 hours for a confirmation, one hour for a reset.
 *
 * Different because the two links are worth different amounts. A verification
 * link proves an address is reachable and grants nothing else; a reset link is a
 * standing offer to take over the account, and it sits in an inbox that may not
 * be the owner's — which is exactly the case forgot-password can be pointed at
 * by a stranger. The shorter window is the difference.
 */
const VERIFY_TTL_SECONDS = 60 * 60 * 24;
const RESET_TTL_SECONDS = 60 * 60;

/**
 * Long enough that guessing is not a strategy. Appwrite's default is six
 * characters, which is right for a code someone retypes from a phone and wrong
 * for a secret sitting in a URL that nobody reads.
 */
const TOKEN_LENGTH = 64;

async function createLink(
  userId: string,
  path: string,
  expire: number,
): Promise<string> {
  const token = await admin.users.createToken({ userId, length: TOKEN_LENGTH, expire });

  const url = new URL(path, env.appUrl);
  url.searchParams.set("userId", userId);
  url.searchParams.set("secret", token.secret);

  return url.toString();
}

/** Confirms an address. Points at the route handler, which redirects to the page. */
export function createVerificationLink(userId: string): Promise<string> {
  return createLink(userId, "/api/auth/verify-email", VERIFY_TTL_SECONDS);
}

/** Points at the *page*, because the user has a form to fill in before anything happens. */
export function createResetLink(userId: string): Promise<string> {
  return createLink(userId, "/reset-password", RESET_TTL_SECONDS);
}

/**
 * Spends a token and returns the session it bought.
 *
 * Expired, already used and never-existed are one outcome on purpose: they are
 * indistinguishable to the person holding the link, and the fix is the same for
 * all three.
 */
export async function consumeToken(
  userId: string,
  secret: string,
): Promise<Models.Session> {
  try {
    // The admin client and not a per-request one: `createSession` is the API
    // key's call, and the memoised client must never be mutated to carry a
    // forwarded user agent — it is shared by every concurrent request, so a
    // setter here would attribute one visitor's session to another's browser.
    // The forwarding happens on `createSessionClient`, which is built per call.
    return await admin.account.createSession({ userId, secret });
  } catch (error) {
    if (isAppwriteException(error) && (error.code === 401 || error.code === 400)) {
      throw new UnauthorizedError(
        "That link has expired or has already been used. Ask for a new one.",
      );
    }
    throw error;
  }
}
