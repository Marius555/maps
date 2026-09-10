import "server-only";

import { Account, Client } from "node-appwrite";

import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "./config";

/**
 * Session client — acts as the signed-in user.
 *
 * A NEW client on every call, never memoised. A cached one would hand user A's
 * identity to user B on the next request.
 *
 * It exposes only `account`, because proving who the caller is via `account.get()`
 * is the one job it has. Row access belongs to the admin client behind the
 * repositories (see admin.ts).
 *
 * `userAgent` is the caller's own `user-agent`, forwarded so Appwrite records the
 * *browser* against the session rather than this Node process. Without it every
 * row in the console's session list reads the same, which makes the list useless
 * for the one thing it is for: spotting a session the account's owner did not
 * start. Optional because most callers have no request in hand — a session is
 * only ever created in three places, and those three pass it.
 */
export function createSessionClient(secret: string, userAgent?: string) {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setSession(secret);

  if (userAgent) client.setForwardedUserAgent(userAgent);

  return { account: new Account(client) };
}
