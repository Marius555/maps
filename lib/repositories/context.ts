import type { WorkspaceRole } from "@/lib/team/roles";

/**
 * The id of a workspace: the user id of the person who owns it.
 *
 * Every `userId` column that means "whose is this" (maps, cardDesigns,
 * subscriptions, usage, sheetLinks) holds one of these. Every row ever written
 * already held its founder's id, which is why teams needed no data migration —
 * docs/notes/team.md.
 *
 * **Branded, so a person's id cannot be passed where a workspace's is meant.**
 * The plan, the lookup allowance and the publish slots are the workspace's, and
 * before teams `getUserPlan(user.id)` was always right. Now a member editing
 * somebody else's map must be measured against *that* map's workspace, and a
 * plain string would let `user.id` keep compiling everywhere it used to be
 * written. Only the constructors below make one.
 */
export type WorkspaceId = string & { readonly [workspaceBrand]: true };

declare const workspaceBrand: unique symbol;

/**
 * Everything a repository needs to know about the caller.
 *
 * - `workspaceId` — whose data this request reads and writes. Every scoped query
 *   and every plan or allowance read uses it.
 * - `actorId` — the person signed in. Only person-scoped things use it: who
 *   sent an invite, whose membership is being changed.
 * - `role` — what that person may do here (lib/team/roles.ts).
 *
 * The session secret never leaves /lib/auth, because row access runs through
 * the admin client (see lib/appwrite/admin.ts).
 */
export type RepoContext = {
  workspaceId: WorkspaceId;
  actorId: string;
  role: WorkspaceRole;
};

/** A person's own workspace, keyed by their user id. */
export function ownWorkspace(userId: string): WorkspaceId {
  return userId as WorkspaceId;
}

/**
 * The workspace a stored owner column names — `maps.userId`, `sheetLinks.userId`.
 * Distinct from `ownWorkspace` only in what the caller is saying it holds.
 */
export function asWorkspaceId(storedUserId: string): WorkspaceId {
  return storedUserId as WorkspaceId;
}

/** The person signed in, working in their own workspace. */
export function ownerContext(userId: string): RepoContext {
  return { workspaceId: ownWorkspace(userId), actorId: userId, role: "owner" };
}

/** A member working in somebody else's workspace. Built by lib/team/resolve.ts only. */
export function memberContext(
  workspaceId: WorkspaceId,
  actorId: string,
  role: WorkspaceRole,
): RepoContext {
  return { workspaceId, actorId, role };
}

/**
 * Work nobody signed in for — the hourly sheet sync — acting with the owner's
 * rights on the workspace a stored row names. The actor is the owner too, so
 * nothing it does is ever attributed to a member who may since have left.
 */
export function systemContext(workspaceId: WorkspaceId): RepoContext {
  return { workspaceId, actorId: workspaceId, role: "owner" };
}
