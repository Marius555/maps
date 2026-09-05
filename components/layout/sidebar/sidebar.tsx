"use client";

import { ScrollShadow } from "@heroui/react";
import { ChevronsLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconButton } from "@/components/ui/icon-button";
import type { AuthUser } from "@/lib/auth/types";
import { PRODUCT_NAME } from "@/lib/config";
import { hidesAppNav } from "@/lib/layout/app-nav";
import { UserMenu } from "../user-menu";
import { useSidebar } from "./sidebar-context";
import { SidebarNav } from "./sidebar-nav";

/**
 * The desktop sidebar.
 *
 * Hidden below `md`, where the same nav is served by the drawer instead.
 *
 * The width comes from a CSS variable so collapsing animates one property, and
 * the whole transition is dropped under `prefers-reduced-motion` by the blanket
 * rule in globals.css (CLAUDE.md §8).
 *
 * Every label collapses to `max-w-0` rather than unmounting. Unmounting was the
 * reason this read as broken even before the width was animated: the text
 * vanished a frame before the panel started moving, so the two halves of one
 * gesture looked like two unrelated events. `max-width` is used rather than
 * `width` because it animates reliably from an `auto`-sized flex child, and the
 * labels stay in the accessibility tree either way.
 *
 * `overflow-hidden` is what makes the clip clean. It is safe for the user menu
 * and the tooltips because React Aria portals both out of this subtree.
 */
export function Sidebar({ user }: { user: AuthUser }) {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const pathname = usePathname();

  /*
   * The publish designer takes this column rather than sitting beside it — see
   * lib/layout/app-nav.ts. Returning null and not hiding with a class, because
   * the point is to give the width back: a `hidden` rail still occupies its
   * place in the flex row at every breakpoint above `md`.
   */
  if (hidesAppNav(pathname)) return null;

  return (
    <aside
      // Not `hidden md:flex` — `hidden` would drop it from the tab order in a way
      // that reads as broken if the viewport is resized mid-session.
      className="hidden w-[var(--sidebar-w)] shrink-0 overflow-hidden border-r border-border transition-[width] duration-[var(--duration-panel)] ease-[var(--ease-out-fluid)] md:flex md:flex-col"
      style={
        { "--sidebar-w": isCollapsed ? "3.5rem" : "15rem" } as React.CSSProperties
      }
    >
      <div
        className={`flex min-h-14 items-center px-2 ${
          isCollapsed ? "justify-center gap-0" : "gap-1"
        }`}
      >
        <Link
          href="/maps"
          aria-hidden={isCollapsed}
          tabIndex={isCollapsed ? -1 : undefined}
          className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap text-sm font-semibold tracking-tight text-foreground transition-[max-width,opacity,padding] duration-[var(--duration-panel)] ease-[var(--ease-out-fluid)] ${
            isCollapsed
              ? "pointer-events-none max-w-0 px-0 opacity-0"
              : "max-w-full px-1.5 opacity-100"
          }`}
        >
          {PRODUCT_NAME}
        </Link>

        {/* One icon that rotates, not two that swap. A swap is a cut in the
            middle of a transition that is otherwise continuous. */}
        <IconButton
          label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          icon={ChevronsLeft}
          placement="right"
          onPress={toggleCollapsed}
          className={`shrink-0 transition-transform duration-[var(--duration-panel)] ease-[var(--ease-out-fluid)] ${
            isCollapsed ? "rotate-180" : ""
          }`}
        />
      </div>

      <ScrollShadow className="min-h-0 flex-1 px-2 py-2" hideScrollBar>
        <SidebarNav isCollapsed={isCollapsed} />
      </ScrollShadow>

      <div className="p-2">
        <UserMenu user={user} isCollapsed={isCollapsed} />
      </div>
    </aside>
  );
}
