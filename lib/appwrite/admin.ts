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
