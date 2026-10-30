import { noContent } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { ForbiddenError, NotFoundError } from "@/lib/repositories/errors";
import {
  declineInvite,
  findInviteByToken,
  normaliseEmail,
} from "@/lib/repositories/invites.repository";
import { isInviteToken } from "@/lib/team/token";

type Params = { token: string };

/**
 * Turn an invite down. Only its addressee may — the inviter holds the link too,
 * and has Revoke for taking it back. Allowed before the address is confirmed:
 * declining grants nothing, and somebody who never wanted the account should
 * not have to confirm it to say no.
 */
export const DELETE = withPersonalAuth<Params>(
  async ({ params, user }) => {
    const invite = isInviteToken(params.token) ? await findInviteByToken(params.token) : null;

    if (!invite) throw new NotFoundError("That invite doesn't exist any more.");

    if (normaliseEmail(user.email) !== invite.email) {
      throw new ForbiddenError(`This invite was sent to ${invite.email}.`);
    }

    await declineInvite(invite);

    return noContent();
  },
  { allowUnverified: true },
);
