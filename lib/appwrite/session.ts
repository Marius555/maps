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
 */
export function createSessionClient(secret: string) {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setSession(secret);

  return { account: new Account(client) };
}
