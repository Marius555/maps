import "server-only";

import { env } from "@/lib/env";
import type { AdminConfig } from "./session";

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
