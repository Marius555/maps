import { noContent } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import {
  declineInvite,
  getInviteForEmail,
} from "@/lib/repositories/invites.repository";

type Params = { inviteId: string };

/** Turn down an invitation from the list. Only ever one addressed to you. */
export const DELETE = withPersonalAuth<Params>(
  async ({ params, user }) => {
    await declineInvite(await getInviteForEmail(params.inviteId, user.email));

    return noContent();
  },
);
