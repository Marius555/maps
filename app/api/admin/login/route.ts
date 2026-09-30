import { timingSafeEqual } from "node:crypto";

import { noContent } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { adminConfig } from "@/lib/admin/auth/config";
import { setAdminCookie } from "@/lib/admin/auth/cookie";
import { decoyHash, verifyPassword } from "@/lib/admin/auth/password";
import { signAdminSession } from "@/lib/admin/auth/session";
import { readIp } from "@/lib/analytics/collect/geo-headers";
import { throttle } from "@/lib/auth/throttle";
import { NotFoundError, RepositoryError } from "@/lib/repositories/errors";
import { adminLoginSchema } from "@/lib/validation/admin.schema";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Sign in to the operator console.
 *
 * - **Switched off, it does not exist**: a 404, the same answer the two pages
 *   give, so an install without the three `ADMIN_*` values has no admin surface
 *   to probe.
 * - **Throttled twice** — per address and in total. Per address stops one
 *   client guessing; the global ceiling stops a spread of them, and costs the
 *   real admin at most a fifteen-minute wait, which for a one-person console is
 *   the right trade. Best effort, like every `throttle()` (the file says why);
 *   the scrypt cost is the defence that survives a restart.
 * - **One answer for every failure**, and the same time for it: a wrong email
 *   still spends a full scrypt against a decoy, so neither the message nor the
 *   clock says which half was right.
 */
export const POST = withoutAuth(async (request) => {
  const config = adminConfig();
  if (!config) throw new NotFoundError();

  const ip = readIp(request.headers) ?? "unknown";

  throttle({ key: `admin-login:${ip}`, limit: 5, windowMs: WINDOW_MS });
  throttle({ key: "admin-login:*", limit: 20, windowMs: WINDOW_MS });

  const { email, password } = await parseBody(request, adminLoginSchema);

  const emailMatches = sameText(email.trim().toLowerCase(), config.email);
  const passwordMatches = await verifyPassword(
    password,
    emailMatches ? config.passwordHash : await decoyHash(),
  );

  if (!emailMatches || !passwordMatches) {
    console.warn(`Admin sign-in refused from ${ip}.`);

    throw new RepositoryError("unauthorized", "Email or password is incorrect.", 401);
  }

  await setAdminCookie(signAdminSession(config));

  return noContent();
});

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
