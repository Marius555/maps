import { noContent } from "@/lib/api/responses";
import { withoutAuth } from "@/lib/api/route";
import { revokeSession } from "@/lib/auth/account";
import { clearSessionCookie, readSessionSecret } from "@/lib/auth/session-cookie";

/** POST, never GET: a link prefetch must not be able to log someone out. */
export const POST = withoutAuth(async () => {
  const secret = await readSessionSecret();
  if (secret) await revokeSession(secret);

  await clearSessionCookie();

  return noContent();
});
