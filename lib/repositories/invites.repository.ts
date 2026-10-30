import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isConflict, isNotFound, toRepositoryError } from "@/lib/appwrite/errors";
import { readPeople } from "@/lib/auth/people";
import { env } from "@/lib/env";
import { SEAT_LIMITS } from "@/lib/limits/plans";
import { canManage, MEMBER_ROLES, type MemberRole } from "@/lib/team/roles";
import { hashInviteToken, INVITE_TTL_MS, mintInviteToken } from "@/lib/team/token";
import type { Invite, Membership } from "@/lib/team/types";
import { asWorkspaceId, type RepoContext, type WorkspaceId } from "./context";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RepositoryError,
  RoleRequiredError,
  SeatLimitError,
} from "./errors";
import { addMember, deleteMembershipRow, listMembers } from "./memberships.repository";
import { getUserPlan, rollBackIfOverLimit } from "./plan-limits";

/**
 * Invitations into a workspace — the `invites` table — and the one path by
 * which anybody becomes a member: accepting one.
 *
 * **A pending invite holds a seat.** The seat count is owner + members + live
 * invites, so inviting faster than people accept cannot overfill a team. An
 * expired invite holds nothing and can be resent.
 *
 * **Nothing here looks an address up.** Inviting an address never asks whether
 * it has an account, and accepting checks the signed-in person's own confirmed
 * address against the invite — so an invite cannot be used to learn who has
 * signed up (docs/notes/auth.md, "answer the same whether or not the address
 * exists"). docs/notes/team.md has the rest.
 */

const MAX_INVITES = 100;

/** A resend more often than this is somebody's mailbox being flooded. */
const RESEND_INTERVAL_MS = 60 * 1000;

type InviteRow = Models.Row & {
  workspaceId: string;
  email: string;
  role: string;
  invitedBy: string;
  tokenHash: string;
  expiresAt: string;
  sentAt?: string | null;
};

function toInvite(row: InviteRow): Invite {
  return {
    id: row.$id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: (MEMBER_ROLES as readonly string[]).includes(row.role)
      ? (row.role as MemberRole)
      : "viewer",
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt,
    sentAt: row.sentAt ?? null,
    createdAt: row.$createdAt,
  };
}

/** Lowercased and trimmed: the form an address is stored and compared in. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isLive(invite: Pick<Invite, "expiresAt">, now = Date.now()): boolean {
  return Date.parse(invite.expiresAt) > now;
}

/** Every invite a workspace has out, live or expired, oldest first. */
export async function listWorkspaceInvites(workspaceId: WorkspaceId): Promise<Invite[]> {
  try {
    const result = await admin.tablesDB.listRows<InviteRow>({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      queries: [
        Query.equal("workspaceId", workspaceId),
        Query.orderAsc("$createdAt"),
        Query.limit(MAX_INVITES),
      ],
    });

    return result.rows.map(toInvite);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Seats taken: the owner, every member, and — when inviting — every live
 * invite. Accepting leaves invites out, because the invite being accepted
 * already holds the seat its member is about to take; counting it too would
 * refuse the last invite into a team that is exactly full.
 */
export async function seatsUsed(
  workspaceId: WorkspaceId,
  { countInvites }: { countInvites: boolean },
): Promise<number> {
  const [members, invites] = await Promise.all([
    listMembers(workspaceId),
    countInvites ? listWorkspaceInvites(workspaceId) : Promise.resolve([]),
  ]);

  return 1 + members.length + invites.filter((invite) => isLive(invite)).length;
}

/**
 * Invite `email` into `ctx.workspaceId` as `role`.
 *
 * Returns the raw token once, for the link in the email and the inviter's Copy
 * link; it is never readable again.
 */
export async function createInvite(
  ctx: RepoContext,
  input: { email: string; role: MemberRole },
): Promise<{ invite: Invite; token: string }> {
  if (!canManage(ctx.role, null, input.role)) {
    throw new RoleRequiredError(
      input.role === "admin"
        ? "Only the owner can invite admins."
        : "Only the owner or an admin can invite people.",
    );
  }

  const email = normaliseEmail(input.email);
  const plan = await getUserPlan(ctx.workspaceId);
  const limit = SEAT_LIMITS[plan].seats;

  const [members, invites] = await Promise.all([
    listMembers(ctx.workspaceId),
    listWorkspaceInvites(ctx.workspaceId),
  ]);

  // Only the people already on the team are looked up — by id, never by the
  // address being invited.
  const people = await readPeople([ctx.workspaceId, ...members.map((member) => member.userId)]);
  const onTeam = [...people.values()].some((person) => normaliseEmail(person.email) === email);

  if (onTeam) throw new ConflictError(`${email} is already on this team.`);

  const existing = invites.find((invite) => invite.email === email);

  if (existing && isLive(existing)) {
    throw new ConflictError(`There's already an invite out for ${email}. Resend it instead.`);
  }

  // An expired invite to the same address holds no seat and would only collide
  // with the unique index; it is replaced rather than reused, so a new role and
  // a new inviter are recorded as what they are.
  if (existing) await deleteInviteRow(existing.id);

  const live = invites.filter((invite) => invite !== existing && isLive(invite)).length;

  if (1 + members.length + live >= limit) throw new SeatLimitError(limit, plan);

  const { token, hash } = mintInviteToken();
  const now = new Date();

  let row: InviteRow;

  try {
    row = await admin.tablesDB.createRow<InviteRow>({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      rowId: ID.unique(),
      data: {
        workspaceId: ctx.workspaceId,
        email,
        role: input.role,
        invitedBy: ctx.actorId,
        tokenHash: hash,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
        sentAt: now.toISOString(),
      },
      permissions: [],
    });
  } catch (error) {
    // Two admins inviting the same address in the same instant.
    if (isConflict(error)) {
      throw new ConflictError(`There's already an invite out for ${email}. Resend it instead.`);
    }
    throw toRepositoryError(error);
  }

  await rollBackIfOverLimit({
    total: () => seatsUsed(ctx.workspaceId, { countInvites: true }),
    limit,
    undo: () => deleteInviteRow(row.$id),
    error: new SeatLimitError(limit, plan),
  });

  return { invite: toInvite(row), token };
}

/** The invite one of `ctx.workspaceId`'s admins is acting on, or 404. */
async function getWorkspaceInvite(ctx: RepoContext, inviteId: string): Promise<Invite> {
  const invite = await readInviteRow(inviteId);

  if (!invite || invite.workspaceId !== ctx.workspaceId) {
    throw new NotFoundError("That invite doesn't exist any more.");
  }

  return invite;
}

/**
 * Send an invite again with a fresh link and a fresh week. The old link stops
 * working — only the new token's hash is kept — which is also how an inviter
 * takes back a link they pasted somewhere they should not have.
 */
export async function resendInvite(
  ctx: RepoContext,
  inviteId: string,
): Promise<{ invite: Invite; token: string }> {
  const invite = await getWorkspaceInvite(ctx, inviteId);

  if (!canManage(ctx.role, null, invite.role)) {
    throw new RoleRequiredError("Only the owner can resend an invite to become an admin.");
  }

  if (invite.sentAt && Date.now() - Date.parse(invite.sentAt) < RESEND_INTERVAL_MS) {
    throw new RepositoryError(
      "rate_limited",
      "That invite went out a moment ago. Wait a minute before sending it again.",
      429,
    );
  }

  // A resend of an expired invite takes a seat again, so it is counted again.
  if (!isLive(invite)) {
    const plan = await getUserPlan(ctx.workspaceId);
    const limit = SEAT_LIMITS[plan].seats;

    if ((await seatsUsed(ctx.workspaceId, { countInvites: true })) >= limit) {
      throw new SeatLimitError(limit, plan);
    }
  }

  const { token, hash } = mintInviteToken();
  const now = new Date();

  try {
    const row = await admin.tablesDB.updateRow<InviteRow>({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      rowId: invite.id,
      data: {
        tokenHash: hash,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
        sentAt: now.toISOString(),
      },
    });

    return { invite: toInvite(row), token };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function revokeInvite(ctx: RepoContext, inviteId: string): Promise<void> {
  const invite = await getWorkspaceInvite(ctx, inviteId);

  if (!canManage(ctx.role, invite.role, null)) {
    throw new RoleRequiredError("Only the owner can take back an invite to become an admin.");
  }

  await deleteInviteRow(invite.id);
}

/** The invite a link names, or null — expired ones included, so the page can say so. */
export async function findInviteByToken(token: string): Promise<Invite | null> {
  try {
    const result = await admin.tablesDB.listRows<InviteRow>({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      queries: [Query.equal("tokenHash", hashInviteToken(token)), Query.limit(1)],
    });

    const row = result.rows[0];

    return row ? toInvite(row) : null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Live invites addressed to one person — "Invitations for you".
 *
 * **Only ever called with a confirmed address.** Anybody can sign up as
 * someone else's address; until they confirm it, seeing the invites sent to it
 * would hand them the team.
 */
export async function listInvitesForEmail(email: string): Promise<Invite[]> {
  try {
    const result = await admin.tablesDB.listRows<InviteRow>({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      queries: [
        Query.equal("email", normaliseEmail(email)),
        Query.greaterThan("expiresAt", new Date().toISOString()),
        Query.limit(MAX_INVITES),
      ],
    });

    return result.rows.map(toInvite);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** The invite with this id if it is addressed to `email`, or 404. */
export async function getInviteForEmail(inviteId: string, email: string): Promise<Invite> {
  const invite = await readInviteRow(inviteId);

  if (!invite || invite.email !== normaliseEmail(email)) {
    throw new NotFoundError("That invite doesn't exist any more.");
  }

  return invite;
}

/**
 * Join the workspace an invite is for.
 *
 * The caller has already proved who is accepting: the route runs behind the
 * email gate, so `person.email` is a confirmed address, and it must be the one
 * the invite was sent to — holding the link is not enough, because the inviter
 * was handed a copy of it too.
 *
 * Accepting twice is harmless: somebody already on the team keeps the role they
 * have, and the invite is used up either way.
 */
export async function acceptInvite(
  person: { id: string; email: string },
  invite: Invite,
): Promise<{ workspaceId: WorkspaceId; membership: Membership | null }> {
  const workspaceId = asWorkspaceId(invite.workspaceId);

  if (!isLive(invite)) {
    throw new NotFoundError("This invite has expired. Ask whoever sent it for a new one.");
  }

  if (normaliseEmail(person.email) !== invite.email) {
    throw new ForbiddenError(
      `This invite was sent to ${invite.email}. Log in with that address to accept it.`,
    );
  }

  if (workspaceId === person.id) {
    await deleteInviteRow(invite.id);
    throw new ConflictError("That's your own team — you're already its owner.");
  }

  const plan = await getUserPlan(workspaceId);
  const limit = SEAT_LIMITS[plan].seats;
  const members = await listMembers(workspaceId);
  const already = members.find((member) => member.userId === person.id);

  if (already) {
    await deleteInviteRow(invite.id);

    return { workspaceId, membership: already };
  }

  if (1 + members.length >= limit) throw new SeatLimitError(limit, plan);

  const { membership, created } = await addMember(workspaceId, person.id, invite.role);

  if (created) {
    await rollBackIfOverLimit({
      total: async () => 1 + (await listMembers(workspaceId)).length,
      limit,
      undo: () => deleteMembershipRow(membership.id),
      error: new SeatLimitError(limit, plan),
    });
  }

  await deleteInviteRow(invite.id);

  return { workspaceId, membership };
}

/** Turn an invite down. Anybody holding the link may; it only removes the invite. */
export async function declineInvite(invite: Invite): Promise<void> {
  await deleteInviteRow(invite.id);
}

/** Account deletion: every invite out from the deleted person's workspace. */
export async function deleteInvitesForWorkspace(workspaceId: WorkspaceId): Promise<void> {
  try {
    await admin.tablesDB.deleteRows({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      queries: [Query.equal("workspaceId", workspaceId)],
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

async function readInviteRow(inviteId: string): Promise<Invite | null> {
  try {
    const row = await admin.tablesDB.getRow<InviteRow>({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      rowId: inviteId,
    });

    return toInvite(row);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw toRepositoryError(error);
  }
}

async function deleteInviteRow(id: string): Promise<void> {
  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.invites,
      rowId: id,
    });
  } catch (error) {
    // Gone already — a decline racing an accept. The goal was its absence.
    if (isNotFound(error)) return;
    throw toRepositoryError(error);
  }
}
