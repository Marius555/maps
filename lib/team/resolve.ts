import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { readPeople } from "@/lib/auth/people";
import { SEAT_LIMITS, type PlanId } from "@/lib/limits/plans";
import { effectiveRole, seatHolders } from "@/lib/limits/seat-slots";
import {
  asWorkspaceId,
  memberContext,
  ownWorkspace,
  ownerContext,
  type RepoContext,
  type WorkspaceId,
} from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { readMapForAccess } from "@/lib/repositories/maps.repository";
import { listMembers, listMembershipsOf } from "@/lib/repositories/memberships.repository";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import type { AppMap } from "@/lib/repositories/types";
import { ACTIVE_WORKSPACE_COOKIE } from "./active-cookie";
import type { WorkspaceRole } from "./roles";
import type { WorkspaceSummary } from "./types";

/**
 * Which workspace a request is about, and what the signed-in person may do
 * there — the one place a `RepoContext` for a member is made.
 *
 * Three answers, chosen per route (lib/api/route.ts, `workspace` option):
 *
 * - **From a map** (`resolveMapContext`): every `/maps/[id]` page and
 *   `/api/maps/[id]` route. The workspace is whoever owns the map, so a tab
 *   showing a team's map keeps working after another tab switched teams.
 * - **From the active-workspace cookie** (`resolveActiveContext`): the maps
 *   list, creating a map, Settings → Team and Usage.
 * - **None**: personal routes — the account, notifications, billing — work in
 *   the person's own workspace.
 *
 * **Membership is read fresh on every request and never cached past it.**
 * Removing somebody has to take effect on their next click, and `AuthUser` —
 * cached for a minute per instance — is the wrong place for anything a team
 * admin can change (docs/notes/auth.md). The owner pays nothing: a person in
 * their own workspace is decided without a read.
 */

const MAP_NOT_FOUND = "That map doesn't exist.";

/**
 * The workspaces one person has joined, read once per server render — the
 * switcher and `personalPlan` both want it on every dashboard page. Outside a
 * render (a route handler) `cache` simply calls through.
 */
const membershipsOf = cache(listMembershipsOf);

/**
 * The role `userId` holds in `workspaceId` right now, or null if none.
 *
 * Reads every member rather than the one row, because the answer depends on
 * the others: after a downgrade the members who joined last read as viewers
 * until the team fits its seats again (lib/limits/seat-slots.ts). Both reads are
 * one round trip, in parallel.
 */
export async function workspaceRoleFor(
  workspaceId: WorkspaceId,
  userId: string,
): Promise<WorkspaceRole | null> {
  if (workspaceId === ownWorkspace(userId)) return "owner";

  const [members, plan] = await Promise.all([
    listMembers(workspaceId),
    getUserPlan(workspaceId),
  ]);

  const mine = members.find((member) => member.userId === userId);
  if (!mine) return null;

  const holders = seatHolders(
    members.map((member) => ({
      userId: member.userId,
      joinedAt: member.joinedAt,
      id: member.id,
    })),
    SEAT_LIMITS[plan].seats,
  );

  return effectiveRole(mine.role, userId, holders);
}

/**
 * The workspace the cookie names, if this person is in it; their own otherwise.
 * A hint that names nothing they belong to is not an error — it is a stale tab
 * or a removed member, and both should simply land at home.
 */
export async function resolveActiveContext(
  userId: string,
  hint: string | null | undefined,
): Promise<RepoContext> {
  if (!hint || hint === userId) return ownerContext(userId);

  const workspaceId = asWorkspaceId(hint);
  const role = await workspaceRoleFor(workspaceId, userId);

  return role ? memberContext(workspaceId, userId, role) : ownerContext(userId);
}

/**
 * The context for one map: its owner's workspace, with this person's role
 * there. A map they cannot reach is missing, never forbidden — the rule
 * `getMap` has always kept, because a 403 would confirm the id is real.
 */
export async function resolveMapContext(
  userId: string,
  mapId: string,
): Promise<{ ctx: RepoContext; map: AppMap }> {
  const map = await readMapForAccess(mapId);

  if (map.userId === userId) return { ctx: ownerContext(userId), map };

  const workspaceId = asWorkspaceId(map.userId);
  const role = await workspaceRoleFor(workspaceId, userId);

  if (!role) throw new NotFoundError(MAP_NOT_FOUND);

  return { ctx: memberContext(workspaceId, userId, role), map };
}

/**
 * The page-side twins, memoised per request. `cache()` keys on argument
 * identity, so both take primitives — a layout and the page under it resolve
 * the same map once between them.
 */
export const loadActiveContext = cache(async (userId: string): Promise<RepoContext> => {
  const jar = await cookies();

  return resolveActiveContext(userId, jar.get(ACTIVE_WORKSPACE_COOKIE)?.value);
});

export const loadMapAccess = cache(
  async (userId: string, mapId: string): Promise<{ ctx: RepoContext; map: AppMap }> =>
    resolveMapContext(userId, mapId),
);

/**
 * Every workspace this person can switch into: their own first, then the ones
 * they joined, named after each owner.
 *
 * The role shown is the stored one. The seat-overflow downgrade is applied where
 * it is enforced (`workspaceRoleFor`), not here: this is a menu label, and
 * reading every team's members and plan on every page load to perfect it would
 * cost a round trip per team for a word.
 */
export const listWorkspacesFor = cache(
  async (userId: string, ownName: string): Promise<WorkspaceSummary[]> => {
    const memberships = await membershipsOf(userId);
    const own: WorkspaceSummary = { id: userId, name: ownName, role: "owner", own: true };

    if (memberships.length === 0) return [own];

    const owners = await readPeople(memberships.map((membership) => membership.workspaceId));

    return [
      own,
      ...memberships
        // A workspace whose owner was deleted has nothing left in it to open.
        .filter((membership) => owners.has(membership.workspaceId))
        .map((membership) => ({
          id: membership.workspaceId,
          name: owners.get(membership.workspaceId)?.name ?? "",
          role: membership.role,
          own: false,
        })),
    ];
  },
);

/**
 * The plan a person is treated as having for things that belong to them rather
 * than to a workspace — which notifications they are shown, whether they may
 * email support: the best plan among their own and every team they are in.
 *
 * The best, so somebody working inside a paid team is not told their account is
 * free, and so the answer does not jump when they switch teams.
 */
export const personalPlan = cache(async (userId: string): Promise<PlanId> => {
  const memberships = await membershipsOf(userId).catch(() => []);
  const plans = await Promise.all([
    getUserPlan(ownWorkspace(userId)),
    ...memberships.map((membership) => getUserPlan(asWorkspaceId(membership.workspaceId))),
  ]);

  return plans.reduce<PlanId>((best, plan) => (RANK[plan] > RANK[best] ? plan : best), "free");
});

const RANK: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };
