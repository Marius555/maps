"use client";

import { Button, Drawer } from "@heroui/react";
import { Menu } from "lucide-react";
import { Suspense, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { IconButton } from "@/components/ui/icon-button";
import { AdminAccountMenu } from "./admin-account-menu";
import { AdminBadge } from "./admin-badge";
import { AdminNavList } from "./admin-nav-list";

/**
 * Below `md`: the customer shell's mobile header and left drawer
 * (`MobileHeader`, `SidebarMobile`), with the console's sections in it.
 * Choosing a section closes the drawer — one left open over the page it just
 * opened is the classic mobile-nav bug.
 */
export function AdminMobileNav({ email }: { email: string }) {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <header className="flex min-h-14 items-center gap-2 px-2 md:hidden">
        <IconButton
          label="Open navigation"
          icon={Menu}
          placement="bottom"
          onPress={() => setOpen(true)}
        />
        <span className="truncate text-sm font-semibold tracking-tight text-foreground">
          <BrandLogo />
        </span>
        <AdminBadge />
      </header>

      <Drawer.Backdrop isOpen={isOpen} onOpenChange={setOpen}>
        <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
          <Drawer.Dialog className="flex h-full flex-col">
            <Drawer.Header>
              <Drawer.Heading className="flex items-center gap-2 text-sm font-semibold">
                <BrandLogo />
                <AdminBadge />
              </Drawer.Heading>
            </Drawer.Header>

            <Drawer.Body className="min-h-0 flex-1">
              <Suspense>
                <AdminNavList onNavigate={() => setOpen(false)} />
              </Suspense>
            </Drawer.Body>

            <Drawer.Footer className="flex-col items-stretch">
              <AdminAccountMenu email={email} />
              <Button slot="close" variant="tertiary" size="sm">
                Close
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}
