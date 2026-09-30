import { noContent } from "@/lib/api/responses";
import { withAdmin } from "@/lib/api/route";
import { clearAdminCookie } from "@/lib/admin/auth/cookie";

/**
 * POST, never GET, so a prefetch cannot sign the admin out. `Clear-Site-Data`
 * for the reason the customer logout sends it: Back must not restore a console
 * page from the bfcache with no request at all.
 */
export const POST = withAdmin(async () => {
  await clearAdminCookie();

  const response = noContent();
  response.headers.set("Clear-Site-Data", '"cache"');

  return response;
});
