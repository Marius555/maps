import type { PlanId } from "@/lib/limits/plans";
import type { MemberRole, WorkspaceRole } from "./roles";

/**
 * The team domain as the dashboard sees it. Plain types only, so client
 * components can import them; the rows they come from stay inside
 * lib/repositories.
 */

/** One person's place in somebody else's workspace. */
export type Membership = {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
};

/** An invitation nobody has accepted yet. The token is never part of it. */
export type Invite = {
  id: string;
  workspaceId: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
  expiresAt: string;
  sentAt: string | null;
  createdAt: string;
};

/** A workspace the signed-in person can switch into. */
export type WorkspaceSummary = {
  id: string;
  /** The owner's name, or their email when they have not set one. */
  name: string;
  /** What the signed-in person may do there — after any seat overflow. */
  role: WorkspaceRole;
  /** True for the person's own workspace. */
  own: boolean;
};

/** A row on the Team page: the owner, or a member with their name resolved. */
export type TeamPerson = {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  /** The role the membership row holds — differs from `role` only when over the seats. */
  storedRole: WorkspaceRole;
  joinedAt: string | null;
  /** The account was deleted outside the app; the row still holds a seat until removed. */
  missing: boolean;
};

/** Everything Settings → Team draws for one workspace. */
export type TeamOverview = {
  workspaceId: string;
  workspaceName: string;
  plan: PlanId;
  seats: number;
  /** Owner + members + live invites. */
  seatsUsed: number;
  viewerRole: WorkspaceRole;
  people: TeamPerson[];
  /** `expired` decided on the server, so the page does not read the clock while rendering. */
  invites: (Invite & { expired: boolean })[];
};
