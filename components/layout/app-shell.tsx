import { VerifyEmailBanner } from "@/components/verify-email/verify-email-banner";
import type { AuthUser } from "@/lib/auth/types";
import type { PlanId } from "@/lib/repositories/plan-limits";
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
 * **It is a frame, exactly one viewport tall, and `<main>` is what scrolls.** It
 * used to be `min-h-[100dvh]` — a floor — so the window scrolled and the sidebar,
 * a stretch-aligned flex child, grew to the full height of the document: its own
 * `ScrollShadow` never had a bounded box to scroll in, and the user menu sat at
 * the foot of the *page*, below the fold on anything long. Now the sidebar is one
 * viewport tall at every scroll position and only the page body moves.
 *
 * `flex-none` beside the height is not decoration. The frame is a flex item of
 * `<body>`'s column, and `flex-1`'s `flex-basis: 0%` beats an explicit `height`
 * there — the same trap `docs/notes/editor-and-layout.md` records for the editor
 * row. `data-app-frame` is what `globals.css` keys off to stop reserving a
 * scrollbar gutter on a document that no longer scrolls; the gutter moves onto
 * `<main>`, which is now the element whose scrollbar comes and goes.
 *
 * `min-h-0` on the body column is load-bearing: the map editor is a flex child
 * that needs to fill the remaining height, and without it a flex parent sizes to
 * its content and the map collapses.
 *
 * `MobileHeader` and `VerifyEmailBanner` sit above `<main>`, outside the scroller,
 * so both stay on screen however far the page has moved. The banner is mounted
 * here because an unconfirmed account is refused every write in the app and the
 * explanation has to be wherever the user is when they find that out. It renders nothing for a confirmed address, which is almost every session.
 * It is a client component reading `useMe()` rather than the `user` prop already
 * in scope here — see its own file for why the prop would go stale.
 */
export function AppShell({
  user,
  plan,
  defaultCollapsed,
  defaultMapId,
  children,
}: {
  user: AuthUser;
  plan: PlanId;
  defaultCollapsed: boolean;
  defaultMapId: string | null;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      defaultCollapsed={defaultCollapsed}
      defaultMapId={defaultMapId}
    >
      <div
        data-app-frame=""
        className="flex h-[100dvh] min-h-0 flex-none overflow-hidden"
      >
        <Sidebar user={user} plan={plan} />
        <SidebarMobile user={user} plan={plan} />

        {/* The provider wraps the header *and* the page, because the trigger a
            page portals into the header is rendered from inside `children`. */}
        <MobileHeaderSlotProvider>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <MobileHeader plan={plan} />
            <VerifyEmailBanner />
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">
              {children}
            </main>
          </div>
        </MobileHeaderSlotProvider>
      </div>
    </SidebarProvider>
  );
}
