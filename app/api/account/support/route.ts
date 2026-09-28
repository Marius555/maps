import { noContent } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { sendSupportRequest } from "@/lib/support/support-request";
import { supportRequestSchema } from "@/lib/validation/support.schema";

/**
 * A bug report or support request from the account menu. See
 * `lib/support/support-request.ts`.
 *
 * Open to an unconfirmed account: a bug in confirming the address is exactly
 * what such an account needs to report, and the only inbox this can reach is
 * ours.
 */
export const POST = withAuth(
  async ({ request, user }) => {
    const input = await parseBody(request, supportRequestSchema);

    await sendSupportRequest({
      user,
      input,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return noContent();
  },
  { allowUnverified: true },
);
