import type { MemberRole, WorkspaceRole } from "@/lib/team/roles";

/**
 * Which members keep their role when a workspace holds more people than its
 * plan allows — only possible after a downgrade, because every invite and every
 * accept is refused at the limit.
 *
 * **Nobody is removed, and the earliest to join keep their roles.** The owner
 * holds one seat; the first `seats - 1` members by join date hold the rest. Every
 * member past that reads as a viewer until somebody leaves or the plan comes
 * back. Viewer rather than locked out, because removing a colleague's access is
 * the owner's decision to make, not a side effect of a billing date — and a
 * viewer costs nothing to keep.
 *
 * The twin of `publish-slots.ts`, and pure for the same reason: the resolver and
 * the Team page rank with this one function and cannot disagree about who is
 * read-only.
 */

export type SeatCandidate = {
  userId: string;
  /** When they joined — the membership row's `$createdAt`. */
  joinedAt: string;
  /** The row id, to break a tie between two members who joined in one instant. */
  id: string;
};

/** The user ids that hold a seat with their own role. Order of `members` is irrelevant. */
export function seatHolders(
  members: readonly SeatCandidate[],
  seats: number,
): Set<string> {
  const ranked = [...members].sort(
    (a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.id.localeCompare(b.id),
  );

  // The owner takes one seat before any member is counted.
  return new Set(ranked.slice(0, Math.max(0, seats - 1)).map((member) => member.userId));
}

/** A member's role as it applies right now: their own, or viewer when over the seats. */
export function effectiveRole(
  role: MemberRole,
  userId: string,
  holders: ReadonlySet<string>,
): WorkspaceRole {
  return holders.has(userId) ? role : "viewer";
}
