"use client";

import { Menu } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { PRODUCT_NAME } from "@/lib/config";
import { useSidebar } from "./sidebar/sidebar-context";

/**
 * Mobile-only header.
 *
 * Deliberately has no desktop counterpart. With a sidebar carrying navigation and
 * each page carrying its own title, a desktop top bar would be a third horizontal
 * band with nothing in it — which is what "a second navbar" looked like. Below
 * `md` there's nowhere else to put the menu trigger, so it exists only there.
 *
 * No bottom border: the header shares the page background, so the chrome reads as
 * one surface instead of a stack of strips.
 */
export function MobileHeader() {
  const { setMobileOpen } = useSidebar();

  return (
    <header className="flex min-h-14 items-center gap-2 px-2 md:hidden">
      <IconButton
        label="Open navigation"
        icon={Menu}
        placement="bottom"
        onPress={() => setMobileOpen(true)}
      />
      <span className="truncate text-sm font-semibold tracking-tight text-foreground">
        {PRODUCT_NAME}
      </span>
    </header>
  );
}
