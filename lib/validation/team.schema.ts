import { z } from "zod";

import { MEMBER_ROLES } from "@/lib/team/roles";

/**
 * Settings → Team's forms, run by the form and again by the route (CLAUDE.md §9).
 */

const memberRole = z.enum(MEMBER_ROLES, "Choose a role.");

export const inviteSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .max(320, "That address is too long.")
    .transform((value) => value.trim().toLowerCase()),
  role: memberRole,
});

export type InviteInput = z.input<typeof inviteSchema>;

export const changeRoleSchema = z.object({
  role: memberRole,
});

export type ChangeRoleInput = z.input<typeof changeRoleSchema>;

/** Switching the dashboard to a workspace — checked against memberships on the server. */
export const switchWorkspaceSchema = z.object({
  workspaceId: z.string().trim().min(1).max(36),
});
