import { noContent } from "@/lib/api/responses";
import { withoutAuth } from "@/lib/api/route";
import { revokeSession } from "@/lib/auth/account";
import { clearSessionCookie, readSessionSecret } from "@/lib/auth/session-cookie";

/** POST, never GET: a link prefetch must not be able to log someone out. */
export const POST = withoutAuth(async () => {
  const secret = await readSessionSecret();
  if (secret) await revokeSession(secret);

  await clearSessionCookie();

  const response = noContent();

  // Evicts the back/forward cache for this origin. Without it a browser can
  // restore the dashboard document on Back with no request at all, and the
  // document navigation in `UserMenu` buys nothing. `cache` and not `storage`:
  // `storage` would also wipe localStorage (theme, sidebar width) and the
  // `map-previews` IndexedDB store.
  response.headers.set("Clear-Site-Data", '"cache"');

  return response;
});
