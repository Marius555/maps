import "server-only";

import { emailGateActive } from "@/lib/auth/email-gate";
import { readPeople } from "@/lib/auth/people";
import type { AuthUser } from "@/lib/auth/types";
import { listInvitesForEmail } from "@/lib/repositories/invites.repository";
import type { MemberRole } from "./roles";

/** An invitation as the person it was sent to sees it. */
export type MyInvitation = {
  id: string;
  workspaceName: string;
  inviterName: string;
  role: MemberRole;
  expiresAt: string;
};

/**
 * Live invitations addressed to this person, for the banner on /maps and
 * Settings → Team.
 *
 * **Only for a confirmed address** — the same rule the email gate keeps, and
 * for the same reason: anybody can sign up as somebody else's address, and an
 * unconfirmed account that could list invitations sent to it could accept its
 * way into a stranger's team. When there is no email provider at all the gate
 * is off (`emailGateActive`), and so is this check, so the two always agree.
 */
export async function listMyInvitations(user: AuthUser): Promise<MyInvitation[]> {
  if (!user.emailVerified && emailGateActive()) return [];

  const invites = (await listInvitesForEmail(user.email)).filter(
    // Your own workspace is never something you are invited to.
    (invite) => invite.workspaceId !== user.id,
  );

  if (invites.length === 0) return [];

  const people = await readPeople(
    invites.flatMap((invite) => [invite.workspaceId, invite.invitedBy]),
  );

  return invites
    .filter((invite) => people.has(invite.workspaceId))
    .map((invite) => ({
      id: invite.id,
      workspaceName: people.get(invite.workspaceId)?.name ?? "",
      inviterName: people.get(invite.invitedBy)?.name ?? "",
      role: invite.role,
      expiresAt: invite.expiresAt,
    }));
}
