"use client";

import { Menu } from "lucide-react";

import { PlanBadge } from "@/components/billing/plan-badge";
import { BrandLogo } from "@/components/brand/brand-logo";
import { IconButton } from "@/components/ui/icon-button";
import { useNotifications } from "@/lib/query/notifications";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { MobileHeaderSlot } from "./mobile-header-slot";
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
 *
 * The far end of the row is a slot (`MobileHeaderSlot`), so a page that has one
 * thing to open can put its trigger on this line instead of growing a bar of its
 * own — the card designer's panel is the first. Empty on every other page, which
 * costs a flex box with nothing in it.
 */
export function MobileHeader({ plan }: { plan: PlanId }) {
  const { setMobileOpen } = useSidebar();
  const unread = useNotifications().data?.unreadCount ?? 0;

  return (
    <header className="flex min-h-14 items-center gap-2 px-2 md:hidden">
      {/* The first-map tutorial points here below `md`, where the Locations
          link is inside a closed drawer. A wrapper, since the Button's own
          props are React Aria's to filter. */}
      <span data-tutorial="nav-menu" className="relative flex">
        <IconButton
          label={unread > 0 ? `Open navigation, ${unread} new notifications` : "Open navigation"}
          icon={Menu}
          placement="bottom"
          onPress={() => setMobileOpen(true)}
        />
        {/* The Notifications row and its count are inside the closed drawer on
            a phone, so the button that opens it carries the news. */}
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-background"
          />
        ) : null}
      </span>
      <span className="truncate text-sm font-semibold tracking-tight text-foreground">
        <BrandLogo />
      </span>

      {/* The badge follows the product name wherever it is drawn. Below `md` the
          sidebar is a drawer you have to open first, so leaving this line out
          would make the plan invisible on a phone. */}
      <PlanBadge plan={plan} />

      <MobileHeaderSlot />
    </header>
  );
}
