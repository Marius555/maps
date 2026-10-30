"use client";

import { createContext, useContext } from "react";

import { can, type TeamAction, type WorkspaceRole } from "@/lib/team/roles";

/**
 * What the signed-in person may do in the workspace this page is about — the
 * map's own on a map page, the switched-to one on the maps list.
 *
 * Provided by the page from the same resolution the server used
 * (`loadMapAccess`, `loadActiveContext`), so a button hidden here and the 403
 * behind it read one table — lib/team/roles.ts. Hiding is the courtesy; the
 * server's refusal is the rule, and the toast in lib/query/client.ts is what a
 * missed button meets.
 *
 * **Absent means owner.** Every page that matters provides it, but a component
 * rendered somewhere that does not — a fixture, a future page — keeps behaving
 * exactly as it did before teams existed rather than going read-only by accident.
 */
const RoleContext = createContext<WorkspaceRole>("owner");

export function RoleProvider({
  role,
  children,
}: {
  role: WorkspaceRole;
  children: React.ReactNode;
}) {
  return <RoleContext value={role}>{children}</RoleContext>;
}

export function useRole(): WorkspaceRole {
  return useContext(RoleContext);
}

export function useCan(action: TeamAction): boolean {
  return can(useRole(), action);
}
