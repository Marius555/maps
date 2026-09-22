import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_MAP_COOKIE,
} from "@/components/layout/sidebar/sidebar-cookies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { sidebarMapId } from "@/lib/repositories/maps.repository";
import { getUserPlan } from "@/lib/repositories/plan-limits";

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

  /*
   * Resolved here rather than per page, because the chrome wears it: the badge
   * beside the product name and the account row in the user menu both say which
   * plan this is. `getUserPlan` is `cache()`d per request, so a page that already
   * needed the plan for a limit pays nothing for this.
   */
  const [plan, mapId] = await Promise.all([
    getUserPlan(user.id),
    sidebarMap(user.id, jar.get(SIDEBAR_MAP_COOKIE)?.value || null),
  ]);

  return (
    <AppShell
      user={user}
      plan={plan}
      defaultCollapsed={isCollapsed}
      defaultMapId={mapId}
    >
      {children}
    </AppShell>
  );
}

/**
 * The map whose section the sidebar keeps on pages outside a map — the last one
 * opened here if this account owns it, else its most recently edited one. See
 * `sidebarMapId`.
 *
 * A failed read falls back to the cookie as it stands, which the sidebar
 * already treats as a hint: it asks for the map through the owner-scoped query
 * every map page uses and hides the section if that fails. A hiccup here must
 * cost the shortcut, not every page in the dashboard.
 */
async function sidebarMap(userId: string, remembered: string | null): Promise<string | null> {
  try {
    return await sidebarMapId(repoContext(userId), remembered);
  } catch (error) {
    console.error("Couldn't choose the sidebar's map:", error);

    return remembered;
  }
}
