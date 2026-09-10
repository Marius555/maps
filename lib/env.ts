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
  /**
   * Transactional email, all three optional.
   *
   * Optional and not `required()` on purpose: a clone with no `.env` still has to
   * boot, and a signup whose welcome mail cannot be sent is still a successful
   * signup. `lib/email/resend.ts` warns once and no-ops when the key is missing,
   * the same "unset means it still works" posture GEOCODER_URL and
   * NEXT_PUBLIC_COLLECT_URL already take.
   *
   * `onboarding@resend.dev` is the sender Resend accepts before a domain is
   * verified, so the default is the one value that actually delivers on a fresh
   * account rather than a placeholder that 403s.
   */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.RESEND_FROM || "onboarding@resend.dev",
  /**
   * The origin every emailed link is built from.
   *
   * **Configured, never read off the request's `Host` header.** Forgot-password
   * takes an attacker-supplied email address and mails a single-use token to it;
   * if the link's origin came from a header the caller controls, a spoofed `Host`
   * would mint a working reset link pointing at the attacker's own server. The
   * one input we cannot let the request decide.
   */
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, ""),
} as const;
