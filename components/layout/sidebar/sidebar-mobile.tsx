"use client";

import { Button, Drawer } from "@heroui/react";

import type { AuthUser } from "@/lib/auth/types";
import { PRODUCT_NAME } from "@/lib/config";
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
export function SidebarMobile({ user }: { user: AuthUser }) {
  const { isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <Drawer.Backdrop isOpen={isMobileOpen} onOpenChange={setMobileOpen}>
      <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
        <Drawer.Dialog className="flex h-full flex-col">
          <Drawer.Header>
            <Drawer.Heading className="text-sm font-semibold">
              {PRODUCT_NAME}
            </Drawer.Heading>
          </Drawer.Header>

          <Drawer.Body className="min-h-0 flex-1">
            <SidebarNav
              isCollapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </Drawer.Body>

          <Drawer.Footer className="flex-col items-stretch">
            <UserMenu user={user} />
            <Button slot="close" variant="tertiary" size="sm">
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
