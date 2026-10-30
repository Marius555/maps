import { ok } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { NotFoundError } from "@/lib/repositories/errors";
import { acceptInvite, findInviteByToken } from "@/lib/repositories/invites.repository";
import { setActiveWorkspace } from "@/lib/team/active-cookie-store";
import { isInviteToken } from "@/lib/team/token";

type Params = { token: string };

const GONE = "This invite isn't valid any more. Ask whoever sent it for a new one.";

/**
 * Accept the invite a link carries, as the person signed in.
 *
 * **Behind the email gate, deliberately** — the default `withPersonalAuth`, no
 * `allowUnverified`. The address on the invite has to be one the person has
 * proved they own: holding the link is not proof, because the inviter was handed
 * a copy of it, and anybody can sign up as an address they do not control. A
 * new account confirms its address and comes back; the invitation is waiting for
 * it on /maps as well, so nothing depends on this link surviving that trip.
 *
 * `"none"` scope: it acts on the person, and a viewer of another team must be
 * able to accept a second invitation.
 */
export const POST = withPersonalAuth<Params>(
  async ({ params, user }) => {
    if (!isInviteToken(params.token)) throw new NotFoundError(GONE);

    const invite = await findInviteByToken(params.token);
    if (!invite) throw new NotFoundError(GONE);

    const { workspaceId } = await acceptInvite(user, invite);

    // Land in the team just joined — that is what the person came for.
    await setActiveWorkspace(workspaceId);

    return ok({ workspaceId });
  },
);
