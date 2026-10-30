import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isConflict, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { MEMBER_ROLES, canManage, type MemberRole } from "@/lib/team/roles";
import type { Membership } from "@/lib/team/types";
import type { RepoContext, WorkspaceId } from "./context";
import { NotFoundError, RoleRequiredError } from "./errors";

/**
 * Who belongs to which workspace — the `memberships` table.
 *
 * A workspace is one person's account (lib/repositories/context.ts), so the
 * owner is never a row here: these are the *other* people. No row carries a
 * permission and every read goes through the admin client, like every table
 * in the app (CLAUDE.md invariants). docs/notes/team.md.
 *
 * A workspace holds at most `SEAT_LIMITS.pro.seats - 1` members, so one page of
 * rows is every member there is; `MAX_MEMBERS` is that page with room to spare.
 */

const MAX_MEMBERS = 100;

type MembershipRow = Models.Row & {
  workspaceId: string;
  userId: string;
  role: string;
};

function toMembership(row: MembershipRow): Membership {
  return {
    id: row.$id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    // An unknown value reads as the least it could be, never the most.
    role: (MEMBER_ROLES as readonly string[]).includes(row.role)
      ? (row.role as MemberRole)
      : "viewer",
    joinedAt: row.$createdAt,
  };
}

/** Every member of a workspace, oldest first — the order seats are held in. */
export async function listMembers(workspaceId: WorkspaceId): Promise<Membership[]> {
  try {
    const result = await admin.tablesDB.listRows<MembershipRow>({
      databaseId: env.databaseId,
      tableId: TABLES.memberships,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.orderAsc("$createdAt"),
        Query.orderAsc("$id"),
        Query.limit(MAX_MEMBERS),
      ],
    });

    return result.rows.map(toMembership);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** Every workspace one person has joined (their own is never among them). */
export async function listMembershipsOf(userId: string): Promise<Membership[]> {
  try {
    const result = await admin.tablesDB.listRows<MembershipRow>({
      databaseId: env.databaseId,
      tableId: TABLES.memberships,
      queries: [
        Query.equal("userId", userId),
        Query.orderAsc("$createdAt"),
        Query.limit(MAX_MEMBERS),
      ],
    });

    return result.rows.map(toMembership);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Add somebody to a workspace. Only the invite path calls this, after its seat
 * check; it is not exported for anything else to grant access with.
 *
 * Joining twice is not an error — the unique index answers with the row that
 * already exists, and its role is left exactly as it was. An invite must never
 * be a way to change somebody's role.
 */
export async function addMember(
  workspaceId: WorkspaceId,
  userId: string,
  role: MemberRole,
): Promise<{ membership: Membership; created: boolean }> {
  try {
    const row = await admin.tablesDB.createRow<MembershipRow>({
      databaseId: env.databaseId,
      tableId: TABLES.memberships,
      rowId: ID.unique(),
      data: { workspaceId, userId, role },
      permissions: [],
    });

    return { membership: toMembership(row), created: true };
  } catch (error) {
    if (isConflict(error)) {
      const existing = await findMember(workspaceId, userId);
      if (existing) return { membership: existing, created: false };
    }

    throw toRepositoryError(error);
  }
}

/** Undo one `addMember` — the seat recount's rollback. */
export async function deleteMembershipRow(id: string): Promise<void> {
  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.memberships,
      rowId: id,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function findMember(
  workspaceId: WorkspaceId,
  userId: string,
): Promise<Membership | null> {
  try {
    const result = await admin.tablesDB.listRows<MembershipRow>({
      databaseId: env.databaseId,
      tableId: TABLES.memberships,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.equal("userId", userId),
        Query.limit(1),
      ],
    });

    const row = result.rows[0];

    return row ? toMembership(row) : null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

const NOT_A_MEMBER = "That person isn't on this team.";

/**
 * Change a member's role, as `ctx.actorId` in `ctx.workspaceId`.
 *
 * `canManage` is the whole escalation rule: an admin may move people between
 * editor and viewer and nothing else. Nobody changes their own role — an admin
 * who could would be an admin who could make themselves one, and the owner has
 * no row to change.
 */
export async function changeMemberRole(
  ctx: RepoContext,
  userId: string,
  next: MemberRole,
): Promise<Membership> {
  const member = await findMember(ctx.workspaceId, userId);

  if (!member) throw new NotFoundError(NOT_A_MEMBER);
  if (userId === ctx.actorId) {
    throw new RoleRequiredError("You can't change your own role. Ask the owner.");
  }
  if (!canManage(ctx.role, member.role, next)) throw new RoleRequiredError(manageMessage());
  if (member.role === next) return member;

  try {
    const row = await admin.tablesDB.updateRow<MembershipRow>({
      databaseId: env.databaseId,
      tableId: TABLES.memberships,
      rowId: member.id,
      data: { role: next },
    });

    return toMembership(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** Take somebody's access away. Leaving is `leaveWorkspace`, never this. */
export async function removeMember(ctx: RepoContext, userId: string): Promise<void> {
  const member = await findMember(ctx.workspaceId, userId);

  if (!member) throw new NotFoundError(NOT_A_MEMBER);
  if (userId === ctx.actorId) {
    throw new RoleRequiredError("Use Leave team to remove yourself.");
  }
  if (!canManage(ctx.role, member.role, null)) throw new RoleRequiredError(manageMessage());

  await deleteMembershipRow(member.id);
}

/** Leave a workspace you joined. The owner has no row, so cannot. */
export async function leaveWorkspace(
  userId: string,
  workspaceId: WorkspaceId,
): Promise<void> {
  const member = await findMember(workspaceId, userId);

  if (!member) throw new NotFoundError("You're not on that team.");

  await deleteMembershipRow(member.id);
}

/**
 * Account deletion: every membership in the deleted person's own workspace, and
 * every membership they held in anybody else's. Both by query, so a person with
 * no team costs two empty deletes.
 */
export async function deleteMembershipsFor(userId: string): Promise<void> {
  try {
    for (const column of ["workspaceId", "userId"] as const) {
      await admin.tablesDB.deleteRows({
        databaseId: env.databaseId,
        tableId: TABLES.memberships,
        queries: [Query.equal(column, userId)],
      });
    }
  } catch (error) {
    throw toRepositoryError(error);
  }
}

function manageMessage(): string {
  return "Only the owner can add, remove or change admins. Admins manage editors and viewers.";
}
