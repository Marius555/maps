import { ok } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import {
  acceptInvite,
  getInviteForEmail,
} from "@/lib/repositories/invites.repository";
import { setActiveWorkspace } from "@/lib/team/active-cookie-store";

type Params = { inviteId: string };

/**
 * Accept an invitation from the list on /maps or Settings → Team — no link
 * needed, because the confirmed address the email gate demands *is* the proof
 * the link would have been. Behind the gate for that reason.
 */
export const POST = withPersonalAuth<Params>(
  async ({ params, user }) => {
    const invite = await getInviteForEmail(params.inviteId, user.email);
    const { workspaceId } = await acceptInvite(user, invite);

    await setActiveWorkspace(workspaceId);

    return ok({ workspaceId });
  },
);
