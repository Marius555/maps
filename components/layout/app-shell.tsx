import type { AuthUser } from "@/lib/auth/types";
import { MobileHeader } from "./mobile-header";
import { Sidebar } from "./sidebar/sidebar";
import { SidebarProvider } from "./sidebar/sidebar-context";
import { SidebarMobile } from "./sidebar/sidebar-mobile";

/**
 * The dashboard shell: persistent sidebar, page body beside it.
 *
 * The shell lives in the dashboard layout, so it stays mounted across every
 * navigation and only the body swaps. That is what makes section switching feel
 * instant rather than like a full page load.
 *
 * `min-h-0` on the body column is load-bearing: the map editor is a flex child
 * that needs to fill the remaining height, and without it a flex parent sizes to
 * its content and the map collapses.
 */
export function AppShell({
  user,
  defaultCollapsed,
  children,
}: {
  user: AuthUser;
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <div className="flex min-h-[100dvh] flex-1">
        <Sidebar user={user} />
        <SidebarMobile user={user} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MobileHeader />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
