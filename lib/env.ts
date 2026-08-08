import "server-only";

/**
 * Server-only environment. These names are deliberately unprefixed so Next never
 * inlines them into a client bundle.
 *
 * The `server-only` import above is the enforcement: any client component that
 * transitively imports this file fails the build instead of shipping the API key.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env and restart the dev server.`,
    );
  }
  return value;
}

export const env = {
  appwriteApiKey: required("APPWRITE_API_KEY"),
  databaseId: required("DATABASE_ID"),
  storageId: required("STORAGE_ID"),
  /**
   * Where published snapshots go. Defaults to the assets bucket because
   * Appwrite Cloud's free plan allows only one bucket per project. Point this at
   * a dedicated bucket on a paid plan and nothing else has to change.
   */
  snapshotStorageId: process.env.SNAPSHOT_STORAGE_ID || required("STORAGE_ID"),
} as const;
