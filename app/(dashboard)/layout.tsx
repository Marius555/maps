import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_MAP_COOKIE,
} from "@/components/layout/sidebar/sidebar-cookies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unseenTutorials } from "@/lib/auth/tutorial";
import { ownWorkspace, type RepoContext } from "@/lib/repositories/context";
import { sidebarMapId } from "@/lib/repositories/maps.repository";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import { listWorkspacesFor, loadActiveContext, personalPlan } from "@/lib/team/resolve";

/**
 * The real guard. proxy.ts only checks whether a session cookie is present —
 * this asks Appwrite whether it means anything.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Read server-side so the sidebar renders at its stored width on the first
  // paint. Doing this on the client would render expanded and then snap shut.
  const jar = await cookies();
  const isCollapsed = jar.get(SIDEBAR_COOKIE)?.value === "1";

  // The workspace the dashboard is switched to — the person's own unless they
  // picked a team (lib/team/resolve.ts). Everything the chrome says about "this
  // plan" and "this map" is that workspace's.
  const ctx = await loadActiveContext(user.id);

  /*
   * Resolved here rather than per page, because the chrome wears them:
   *
   * - `plan` — the badge beside the product name: the switched-to workspace's.
   * - `accountPlan` — the person's own, for the Upgrade row: billing is always
   *   their own account, whatever team they are looking at.
   * - `personalPlan` — the best plan they work under, for Contact support.
   *
   * `getUserPlan` and the membership reads are `cache()`d per request, so a page
   * that already needed one of these pays nothing for it again.
   */
  const [plan, accountPlan, bestPlan, workspaces, mapId, tutorials] = await Promise.all([
    getUserPlan(ctx.workspaceId),
    getUserPlan(ownWorkspace(user.id)),
    personalPlan(user.id),
    listWorkspacesFor(user.id, user.name || user.email),
    sidebarMap(ctx, jar.get(SIDEBAR_MAP_COOKIE)?.value || null),
    // For the overlays that follow the owner between pages. Cached per request,
    // so a page asking about its own overlays reads the prefs no second time.
    unseenTutorials(user.id),
  ]);

  return (
    <AppShell
      user={user}
      plan={plan}
      accountPlan={accountPlan}
      personalPlan={bestPlan}
      workspaces={workspaces}
      activeWorkspaceId={ctx.workspaceId}
      defaultCollapsed={isCollapsed}
      defaultMapId={mapId}
      // The overlays walk through creating and editing; a viewer does neither.
      tutorials={ctx.role === "viewer" ? [] : tutorials}
    >
      {children}
    </AppShell>
  );
}

/**
 * The map whose section the sidebar keeps on pages outside a map — the last one
 * opened here if it is in the switched-to workspace, else that workspace's most
 * recently edited one. See `sidebarMapId`.
 *
 * A failed read falls back to the cookie as it stands, which the sidebar
 * already treats as a hint: it asks for the map through the access-checked
 * query every map page uses and hides the section if that fails. A hiccup here
 * must cost the shortcut, not every page in the dashboard.
 */
async function sidebarMap(ctx: RepoContext, remembered: string | null): Promise<string | null> {
  try {
    return await sidebarMapId(ctx, remembered);
  } catch (error) {
    console.error("Couldn't choose the sidebar's map:", error);

    return remembered;
  }
}
