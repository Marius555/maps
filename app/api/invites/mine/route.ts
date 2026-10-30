import { ok } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { listMyInvitations } from "@/lib/team/my-invitations";

/** Invitations addressed to the signed-in person — empty until their address is confirmed. */
export const GET = withPersonalAuth(
  async ({ user }) => ok({ invitations: await listMyInvitations(user) }),
);
