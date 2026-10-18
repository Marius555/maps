import { noContent } from "@/lib/api/responses";
import { withAdmin } from "@/lib/api/route";
import { clearAdminCookie } from "@/lib/admin/auth/cookie";

/**
 * POST, never GET, so a prefetch cannot sign the admin out. No
 * `Clear-Site-Data`, for the reason the customer logout dropped it (Chrome
 * holds the response for seconds); `AdminRestoreGuard` covers Back instead.
 */
export const POST = withAdmin(async () => {
  await clearAdminCookie();

  return noContent();
});
