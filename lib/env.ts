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
  /**
   * Domains that may sign up whatever the disposable list says.
   *
   * The escape hatch with no deploy attached. `lib/email/disposable.ts` reads a
   * vendored list of 75,000 domains, and the day it is wrong about a real
   * customer's is the day they are locked out at 2am — this un-blocks them in the
   * time it takes to set a variable. The durable fix is `KEEP` in
   * `scripts/build-disposable-domains.mjs`, which survives a regeneration.
   *
   * Unset means the list decides everything, which is the normal state.
   */
  emailDomainAllowlist: (process.env.EMAIL_DOMAIN_ALLOWLIST ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
  /**
   * Billing, through the merchant of record. All optional here and checked where
   * they are used, the way the R2 keys are: a missing billing key should fail a
   * checkout with its own name in the message, not take the whole dashboard down
   * at import time for everyone who is not buying anything.
   *
   * **`LEMON_TEST_API_KEY` is read as a fallback deliberately.** The provider
   * decides test mode from the key itself, not from a flag, so the test key and
   * the live key are the same setting with different values — and naming the
   * variable after the mode would mean renaming it on the day of the first real
   * payment, which is the worst possible day to be editing environment variables.
   * Set `LEMON_API_KEY` in production; the fallback keeps a development `.env`
   * that already has the test key working untouched.
   */
  lemonApiKey: process.env.LEMON_API_KEY || process.env.LEMON_TEST_API_KEY || "",
  lemonStoreId: process.env.LEMON_STORE_ID ?? "",
  /**
   * What the webhook's HMAC is checked against.
   *
   * **Unset means the webhook refuses everybody**, exactly as `CRON_SECRET` unset
   * makes the cron route refuse everybody. An open endpoint that writes
   * subscription rows is somebody else's free Pro plan.
   */
  lemonWebhookSecret: process.env.LEMON_WEBHOOK_SECRET ?? "",
  /**
   * What the anonymous monthly visitor key is salted with
   * (lib/analytics/collect/visitor-key.ts). Optional: unset, the key is salted
   * from `APPWRITE_API_KEY` instead, which is equally secret and always set, so
   * development and self-hosting count visitors with no configuration. Changing
   * it mid-month makes every visitor read as new until the month turns.
   */
  analyticsSalt: process.env.ANALYTICS_SALT ?? "",
  /**
   * One variant id per plan and cadence, as the provider's dashboard shows them.
   *
   * Configuration rather than code because they are different numbers in test and
   * in production, and because a variant is re-created whenever a price changes —
   * which would otherwise be a deploy to sell the same product at a new price.
   */
  lemonVariants: {
    starter: {
      monthly: process.env.LEMON_VARIANT_STARTER_MONTHLY ?? "",
      yearly: process.env.LEMON_VARIANT_STARTER_YEARLY ?? "",
    },
    pro: {
      monthly: process.env.LEMON_VARIANT_PRO_MONTHLY ?? "",
      yearly: process.env.LEMON_VARIANT_PRO_YEARLY ?? "",
    },
  },
} as const;
