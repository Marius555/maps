import { after } from "next/server";

import { created } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { createInvite } from "@/lib/repositories/invites.repository";
import { inviteUrl, sendInviteEmail } from "@/lib/team/invite-email";
import { inviteSchema } from "@/lib/validation/team.schema";

/**
 * Invite somebody into the switched-to workspace.
 *
 * The answer carries the link once, for the dialog's Copy link — the only way an
 * invite reaches anyone while email is not configured, and the way an inviter
 * hands it over in a chat when the mail is slow. The email goes out after the
 * response, and never fails it.
 */
export const POST = withAuth(
  async ({ request, ctx }) => {
    const input = await parseBody(request, inviteSchema);
    const { invite, token } = await createInvite(ctx, input);

    after(() => sendInviteEmail(ctx, invite, token));

    return created({ invite, inviteUrl: inviteUrl(token) });
  },
  { rateLimit: "invite" },
);
