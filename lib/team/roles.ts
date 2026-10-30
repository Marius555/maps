/**
 * Who may do what inside a workspace — the whole role model, as data.
 *
 * A workspace is one person's account: its maps, card design, plan and lookup
 * allowance, all keyed by that person's user id. Other people join it as
 * members. The owner is never a membership row; they are whoever the workspace
 * id names. docs/notes/team.md has the reasoning.
 *
 * Plain data with no imports, so the server's checks and the dashboard's
 * buttons read one table and cannot disagree. A button hidden here is a
 * courtesy; the check that matters is the same call inside the repository.
 */

/** The roles a membership row can hold. Order is the schema's enum order. */
export const MEMBER_ROLES = ["admin", "editor", "viewer"] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export type WorkspaceRole = "owner" | MemberRole;

const RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/** Whether `role` is `min` or above it. */
export function atLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return RANK[role] >= RANK[min];
}

export type TeamAction =
  /** Maps, locations, analytics, usage, the publish snippet. */
  | "view"
  /** Anything that changes a map or what is on it, publishing included. */
  | "edit"
  /** Removing a whole map — its locations, photos, analytics and live snapshot. */
  | "deleteMap"
  /** Invite, remove and re-role editors and viewers. */
  | "manageMembers"
  /** The same for admins. */
  | "manageAdmins"
  /** Leaving somebody else's workspace. The owner cannot leave their own. */
  | "leave";

const MINIMUM: Record<Exclude<TeamAction, "leave">, WorkspaceRole> = {
  view: "viewer",
  edit: "editor",
  deleteMap: "admin",
  manageMembers: "admin",
  manageAdmins: "owner",
};

export function can(role: WorkspaceRole, action: TeamAction): boolean {
  if (action === "leave") return role !== "owner";

  return atLeast(role, MINIMUM[action]);
}

/**
 * Whether `actor` may change a membership (or invite) whose role is `current`
 * into `next`.
 *
 * `current` is null for a new invite, `next` is null for a removal. The one
 * check every team write goes through, so escalation has one place to be
 * wrong in: an admin manages editors and viewers and nothing else — they cannot
 * promote anyone to admin, nor touch an admin's row or an admin's invite.
 * Acting on yourself is refused separately, by the caller, because only it
 * knows the ids.
 */
export function canManage(
  actor: WorkspaceRole,
  current: MemberRole | null,
  next: MemberRole | null,
): boolean {
  if (current === null && next === null) return false;

  const touches = [current, next].filter((role): role is MemberRole => role !== null);

  if (touches.includes("admin")) return can(actor, "manageAdmins");

  return can(actor, "manageMembers");
}

/** The role's name as the dashboard prints it. */
export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

/** One line under each role in the invite dialog and the role menu. */
export const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  admin: "Edits maps, deletes them, and invites or removes editors and viewers.",
  editor: "Edits and publishes maps, imports locations and designs cards.",
  viewer: "Sees every map, its locations and its analytics. Changes nothing.",
};
