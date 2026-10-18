import { noContent } from "@/lib/api/responses";
import { withoutAuth } from "@/lib/api/route";
import { revokeSession } from "@/lib/auth/account";
import { forgetSession } from "@/lib/auth/identity-cache";
import { clearSessionCookie, readSessionSecret } from "@/lib/auth/session-cookie";

/** POST, never GET: a link prefetch must not be able to log someone out. */
export const POST = withoutAuth(async () => {
  const secret = await readSessionSecret();
  if (secret) {
    forgetSession(secret);
    await revokeSession(secret);
  }

  await clearSessionCookie();

  // No `Clear-Site-Data` here, deliberately. It kept Back from restoring the
  // dashboard from the bfcache, but Chrome holds the response until its whole
  // disk cache is walked, and in production that was ~20 seconds of a Log out
  // that did nothing. `RestoreAuthGuard` covers Back instead.
  return noContent();
});
