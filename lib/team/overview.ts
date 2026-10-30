import "server-only";

import { readPeople } from "@/lib/auth/people";
import { SEAT_LIMITS } from "@/lib/limits/plans";
import { effectiveRole, seatHolders } from "@/lib/limits/seat-slots";
import type { RepoContext } from "@/lib/repositories/context";
import { isLive, listWorkspaceInvites } from "@/lib/repositories/invites.repository";
import { listMembers } from "@/lib/repositories/memberships.repository";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import type { TeamOverview, TeamPerson } from "./types";

/**
 * Everything Settings → Team draws for the workspace `ctx` is in: who is on it
 * and as what, which invites are out, and how many seats that leaves.
 *
 * Invites are listed for admins and the owner only — a viewer sees who their
 * colleagues are, not which addresses have been asked to join.
 *
 * A member whose account no longer exists keeps their row, drawn as "Deleted
 * account" with a Remove button: the row still holds a seat until somebody
 * frees it, and hiding it would make the seat count look wrong.
 */
export async function loadTeamOverview(ctx: RepoContext): Promise<TeamOverview> {
  const [plan, members, invites] = await Promise.all([
    getUserPlan(ctx.workspaceId),
    listMembers(ctx.workspaceId),
    listWorkspaceInvites(ctx.workspaceId),
  ]);

  const seats = SEAT_LIMITS[plan].seats;
  const people = await readPeople([ctx.workspaceId, ...members.map((member) => member.userId)]);
  const holders = seatHolders(
    members.map((member) => ({
      userId: member.userId,
      joinedAt: member.joinedAt,
      id: member.id,
    })),
    seats,
  );

  const owner = people.get(ctx.workspaceId);
  const ownerRow: TeamPerson = {
    userId: ctx.workspaceId,
    name: owner?.name ?? "Deleted account",
    email: owner?.email ?? "",
    role: "owner",
    storedRole: "owner",
    joinedAt: null,
    missing: !owner,
  };

  const memberRows: TeamPerson[] = members.map((member) => {
    const person = people.get(member.userId);

    return {
      userId: member.userId,
      name: person?.name ?? "Deleted account",
      email: person?.email ?? "",
      role: effectiveRole(member.role, member.userId, holders),
      storedRole: member.role,
      joinedAt: member.joinedAt,
      missing: !person,
    };
  });

  const seesInvites = ctx.role === "owner" || ctx.role === "admin";
  const live = invites.filter((invite) => isLive(invite));

  return {
    workspaceId: ctx.workspaceId,
    workspaceName: owner?.name ?? "",
    plan,
    seats,
    seatsUsed: 1 + members.length + live.length,
    viewerRole: ctx.role,
    people: [ownerRow, ...memberRows],
    invites: seesInvites
      ? invites.map((invite) => ({ ...invite, expired: !isLive(invite) }))
      : [],
  };
}
