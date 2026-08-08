"use client";

import { ScrollShadow } from "@heroui/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";

import { IconButton } from "@/components/ui/icon-button";
import type { AuthUser } from "@/lib/auth/types";
import { PRODUCT_NAME } from "@/lib/config";
import { UserMenu } from "../user-menu";
import { useSidebar } from "./sidebar-context";
import { SidebarNav } from "./sidebar-nav";

/**
 * The desktop sidebar.
 *
 * Hidden below `md`, where the same nav is served by the drawer instead. The
 * width comes from a CSS variable so collapsing animates one property, and the
 * transition is dropped under `prefers-reduced-motion` (CLAUDE.md §8).
 */
export function Sidebar({ user }: { user: AuthUser }) {
  const { isCollapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      // Not `hidden md:flex` — `hidden` would drop it from the tab order in a way
      // that reads as broken if the viewport is resized mid-session.
      className="hidden shrink-0 border-r border-border md:flex md:flex-col"
      style={{ width: isCollapsed ? "3.5rem" : "15rem" }}
    >
      <div
        className={`flex min-h-14 items-center gap-1 px-2 ${
          isCollapsed ? "justify-center" : ""
        }`}
      >
        {isCollapsed ? null : (
          <Link
            href="/maps"
            className="min-w-0 flex-1 truncate px-1.5 text-sm font-semibold tracking-tight text-foreground"
          >
            {PRODUCT_NAME}
          </Link>
        )}

        <IconButton
          label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          icon={isCollapsed ? PanelLeftOpen : PanelLeftClose}
          placement="right"
          onPress={toggleCollapsed}
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
