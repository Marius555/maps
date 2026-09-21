import { VerifyEmailBanner } from "@/components/verify-email/verify-email-banner";
import type { AuthUser } from "@/lib/auth/types";
import { MobileHeader } from "./mobile-header";
import { MobileHeaderSlotProvider } from "./mobile-header-slot";
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
 *
 * `VerifyEmailBanner` is mounted here, above `<main>` and inside the column that
 * scrolls with the page, because an unconfirmed account is refused every write in
 * the app and the explanation has to be wherever the user is when they find that
 * out. It renders nothing for a confirmed address, which is almost every session.
 * It is a client component reading `useMe()` rather than the `user` prop already
 * in scope here — see its own file for why the prop would go stale.
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

        {/* The provider wraps the header *and* the page, because the trigger a
            page portals into the header is rendered from inside `children`. */}
        <MobileHeaderSlotProvider>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <MobileHeader />
            <VerifyEmailBanner />
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          </div>
        </MobileHeaderSlotProvider>
      </div>
    </SidebarProvider>
  );
}
