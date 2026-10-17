"use client";

import { Drawer } from "@heroui/react";
import { X } from "lucide-react";

import { PlanBadge } from "@/components/billing/plan-badge";
import { BrandLogo } from "@/components/brand/brand-logo";
import { IconButton } from "@/components/ui/icon-button";
import type { AuthUser } from "@/lib/auth/types";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { UserMenu } from "../user-menu";
import { useSidebar } from "./sidebar-context";
import { SidebarNav } from "./sidebar-nav";

/**
 * The same nav as a left drawer, below `md`.
 *
 * Open state lives in the sidebar context so the trigger can sit in the mobile
 * header without prop-drilling. Choosing a destination closes it — a drawer left
 * open over the page it just navigated to is the classic mobile-nav bug.
 */
export function SidebarMobile({ user, plan }: { user: AuthUser; plan: PlanId }) {
  const { isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <Drawer.Backdrop isOpen={isMobileOpen} onOpenChange={setMobileOpen}>
      <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
        <Drawer.Dialog className="flex h-full flex-col">
          <Drawer.Header className="flex-row items-center justify-between gap-2">
            <Drawer.Heading className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <BrandLogo />
              <PlanBadge plan={plan} />
            </Drawer.Heading>
            <IconButton
              slot="close"
              label="Close menu"
              icon={X}
              placement="bottom"
              className="shrink-0"
            />
          </Drawer.Header>

          <Drawer.Body className="min-h-0 flex-1">
            <SidebarNav
              isCollapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </Drawer.Body>

          <Drawer.Footer className="flex-col items-stretch">
            <UserMenu
              user={user}
              plan={plan}
              onNavigate={() => setMobileOpen(false)}
            />
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
