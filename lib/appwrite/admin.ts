import "server-only";

import { Account, Client, Storage, TablesDB } from "node-appwrite";

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
} as const;
