import { after } from "next/server";

import { noContent, ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { resendInvite, revokeInvite } from "@/lib/repositories/invites.repository";
import { inviteUrl, sendInviteEmail } from "@/lib/team/invite-email";

type Params = { inviteId: string };

/** Send the invite again, with a new link and a new week. The old link dies. */
export const POST = withAuth<Params>(
  async ({ params, ctx }) => {
    const { invite, token } = await resendInvite(ctx, params.inviteId);

    after(() => sendInviteEmail(ctx, invite, token));

    return ok({ invite, inviteUrl: inviteUrl(token) });
  },
  { rateLimit: "invite" },
);

/** Take the invite back. Its link stops working and its seat is free. */
export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  await revokeInvite(ctx, params.inviteId);

  return noContent();
});
