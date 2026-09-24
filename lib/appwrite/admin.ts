import "server-only";

import { Account, Client, Storage, TablesDB, Users } from "node-appwrite";

import { env } from "@/lib/env";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "./config";

/**
 * Admin client — carries the API key, so it bypasses row permissions.
 *
 * Every row read and write in the app goes through this client, inside
 * /lib/repositories, always scoped by the caller's userId. That is what makes
 * plan limits (CLAUDE.md §6) genuinely server-side: a user who lifts their
 * session secret out of devtools still cannot talk to the database directly.
 *
 * Memoising is safe because this client holds no per-user state.
 */
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(env.appwriteApiKey);

/**
 * An `Account` that creates sessions with the key, **and says whose browser it
 * is doing it for.** Built fresh per call, never memoised.
 *
 * Sessions in this app are created on the server (the cookie has to be ours,
 * see docs/notes/auth.md), so Appwrite records whatever user agent made the
 * request. Through the shared client above that is this Node process, and every
 * row of Settings → Account's device list read "Unknown device". Forwarding the
 * browser's own user agent fixes that, but it cannot be done on the shared
 * client: a setter on a memoised client would attribute one visitor's session
 * to whichever request set it last. Hence a client per session.
 *
 * The IP cannot be forwarded the same way, so a session's recorded location is
 * our server's, and the device list does not show it.
 */
export function createSessionIssuer(userAgent?: string): Account {
  const issuer = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(env.appwriteApiKey);

  if (userAgent) issuer.setForwardedUserAgent(userAgent);

  return new Account(issuer);
}

export const admin = {
  account: new Account(client),
  tablesDB: new TablesDB(client),
  storage: new Storage(client),
  /**
   * The users service, which is the *other* half of auth and is not reachable
   * from `account`.
   *
   * `account` always answers about whoever the client is acting as — with an API
   * key that is nobody, which is why `authenticateUser` has to re-read the
   * profile through a session client. `users` addresses an account by id without
   * being it, and that is the only way to do the three things the email flows
   * need: mint a token for someone who is not signed in, flip
   * `emailVerification`, and set a password for a person who by definition
   * cannot remember theirs.
   */
  users: new Users(client),
} as const;
