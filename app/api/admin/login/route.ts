import { timingSafeEqual } from "node:crypto";

import { noContent } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { adminConfig } from "@/lib/admin/auth/config";
import { setAdminCookie } from "@/lib/admin/auth/cookie";
import { decoyHash, verifyPassword } from "@/lib/admin/auth/password";
import { signAdminSession } from "@/lib/admin/auth/session";
import { clientIp } from "@/lib/rate-limit/ip";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { NotFoundError, RepositoryError } from "@/lib/repositories/errors";
import { adminLoginSchema } from "@/lib/validation/admin.schema";

/**
 * Sign in to the operator console.
 *
 * - **Switched off, it does not exist**: a 404, the same answer the two pages
 *   give, so an install without the three `ADMIN_*` values has no admin surface
 *   to probe.
 * - **Throttled twice** — per address and in total. Per address stops one
 *   client guessing; the global ceiling stops a spread of them, and costs the
 *   real admin at most a fifteen-minute wait, which for a one-person console is
 *   the right trade. Best effort, like every `rateLimit()` (lib/rate-limit/limiter.ts says why);
 *   the scrypt cost is the defence that survives a restart.
 * - **One answer for every failure**, and the same time for it: a wrong email
 *   still spends a full scrypt against a decoy, so neither the message nor the
 *   clock says which half was right.
 */
export const POST = withoutAuth(async (request) => {
  const config = adminConfig();
  if (!config) throw new NotFoundError();

  // After the config check, so an install with no console still answers 404.
  const ip = clientIp(request.headers);

  rateLimit("adminLogin", ip);
  rateLimit("adminLoginAll", "*");

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
