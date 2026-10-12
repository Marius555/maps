import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { verifyPassword } from "./password";
import type { AdminConfig } from "./session";

/** An account the console accepts: its session config plus how to check its password. */
export type AdminAccount = AdminConfig & {
  checkPassword(plain: string): Promise<boolean>;
};

/**
 * The admin account as configured, or `null` when the console is switched off.
 *
 * All three values or none: an email with no hash would be a console nobody can
 * enter, and a hash with no secret would sign sessions with an empty key, which
 * is a session anybody can forge. A secret shorter than 32 characters counts as
 * unset for the same reason.
 */
export function adminConfig(): AdminConfig | null {
  const { adminEmail, adminPasswordHash, adminSessionSecret } = env;

  if (!adminEmail || !adminPasswordHash || adminSessionSecret.length < 32) {
    return null;
  }

  return {
    email: adminEmail,
    passwordHash: adminPasswordHash,
    secret: adminSessionSecret,
  };
}

/**
 * Every account the console accepts: the configured admin, and in development
 * the test account below. Empty means the console is switched off.
 */
export function adminAccounts(): AdminAccount[] {
  const accounts: AdminAccount[] = [];
  const real = adminConfig();

  if (real) {
    accounts.push({ ...real, checkPassword: (plain) => verifyPassword(plain, real.passwordHash) });
  }

  const dev = devAdminConfig();
  if (dev) accounts.push(dev);

  return accounts;
}

/**
 * A second admin for development and the e2e suite, from `DEV_ADMIN_EMAIL` and
 * `DEV_ADMIN_PASSWORD` — so the tests can sign in to the console without the
 * production admin's password ever being written down.
 *
 * **Inert in a production build**, by the same `NODE_ENV` check that makes
 * `DISABLE_ALL_PLAN` inert: a plain-text password in an env var is fine on a
 * laptop and must be unusable on a host where setting one is a form field.
 *
 * - The password is plain text, so it is compared as SHA-256 digests, timing-safe.
 * - `passwordHash` is only the session's `pv` fingerprint: changing the password
 *   signs its sessions out, as a new `ADMIN_PASSWORD_HASH` does for the real one.
 * - The secret is deterministic, never random: Next holds module state twice per
 *   process (`/api` and pages), and a token signed by the login route must
 *   verify on `/admin`.
 * - Refused when its email is the real admin's, which would give one address two
 *   passwords.
 *
 * Read at call time rather than at module load, so a test can set it per case.
 */
export function devAdminConfig(): AdminAccount | null {
  if (process.env.NODE_ENV === "production") return null;

  const email = (process.env.DEV_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD ?? "";
  if (!email || !password) return null;

  const realEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (email === realEmail) return null;

  warnOnce();

  const expected = digest(password);
  const configured = process.env.ADMIN_SESSION_SECRET ?? "";
  const secret =
    configured.length >= 32
      ? configured
      : createHmac("sha256", process.env.APPWRITE_API_KEY ?? "")
          .update("dev-admin-session")
          .digest("base64url");

  return {
    email,
    passwordHash: `dev:${expected.toString("base64url")}`,
    secret,
    checkPassword: async (plain) => timingSafeEqual(digest(plain), expected),
  };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Once per process: the config is read on every admin request. */
let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;

  console.warn(
    "DEV_ADMIN_EMAIL is set: it signs in to the operator console in development. A production build ignores it.",
  );
}
