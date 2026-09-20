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
   * Where published snapshots are served from — `https://cdn.pinglide.com`, the
   * custom domain on the R2 bucket. **This is the switch**: set, publishing
   * writes to Cloudflare R2 and the three R2 values below become required; unset,
   * it writes to Appwrite Storage exactly as before, so a clone with no
   * Cloudflare account still publishes.
   *
   * Unset is not a production option. Appwrite Storage answers 403 to any Origin
   * not registered as a Web platform, which is every customer's site — see
   * `lib/snapshot/storage.ts`.
   */
  snapshotPublicUrl: (process.env.SNAPSHOT_PUBLIC_URL ?? "").replace(/\/+$/, ""),
  /**
   * R2's S3 credentials. Read only when `snapshotPublicUrl` is set, and checked
   * where they are used (`lib/r2/client.ts`) rather than with `required()`: a
   * missing key should fail a publish with its name, not take the whole
   * dashboard down at import. Never `CLOUDFLARE_API_TOKEN` — that one configures
   * the bucket once (`npm run setup:r2`) and never reaches the deployed site.
   */
  r2AccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2SnapshotBucket: process.env.R2_SNAPSHOT_BUCKET || "snapshots",
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
