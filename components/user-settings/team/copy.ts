/**
 * Settings → Team's fixed words, shared by the page and its `loading.tsx` so the
 * two wrap the same and the skeleton is the page's own height. A plain module,
 * not a component file, so a server component reads the strings rather than a
 * client reference (CLAUDE.md, "Stack specifics").
 */
export const MEMBERS_SECTION = {
  description:
    "Everyone who can open this workspace's maps. Each person, and each invite not yet accepted, takes a seat.",
} as const;

export const INVITES_SECTION = {
  title: "Pending invites",
  description:
    "An invite holds its seat until it's accepted, taken back, or a week passes. Resending makes a new link and the old one stops working.",
} as const;

export const YOUR_TEAMS_SECTION = {
  title: "Teams you're in",
  description: "Other people's workspaces you were invited into. Leaving takes away your access to their maps.",
} as const;

export const INVITATIONS_SECTION = {
  title: "Invitations for you",
  description: "Teams that invited this address. Joining lets you work on their maps.",
} as const;

/** The section title for the workspace on screen. */
export function membersTitle(workspaceName: string, own: boolean): string {
  if (own) return "Your team";

  return workspaceName ? `${workspaceName}'s team` : "Team";
}
