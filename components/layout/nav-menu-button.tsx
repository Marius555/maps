"use client";

import { Menu } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { useNotifications } from "@/lib/query/notifications";
import { useSidebar } from "./sidebar/sidebar-context";

/**
 * The hamburger that opens the nav drawer below `md`.
 *
 * Its own component because it is drawn in two places: the mobile header on
 * every page, and the map editor's locations sheet, which takes the header's
 * place there so the map gets that band back (see `MobileHeader`). Whichever
 * one is on screen is the only one rendered, so `data-tutorial="nav-menu"` —
 * the target the onboarding callouts point at below `md` — is never doubled.
 */
export function NavMenuButton() {
  const { setMobileOpen } = useSidebar();
  const unread = useNotifications().data?.unreadCount ?? 0;

  return (
    // The first-map tutorial points here below `md`, where the Locations link is
    // inside a closed drawer. A wrapper, since the Button's own props are React
    // Aria's to filter.
    <span data-tutorial="nav-menu" className="relative flex shrink-0">
      <IconButton
        label={unread > 0 ? `Open navigation, ${unread} new notifications` : "Open navigation"}
        icon={Menu}
        placement="bottom"
        onPress={() => setMobileOpen(true)}
      />
      {/* The Notifications row and its count are inside the closed drawer on a
          phone, so the button that opens it carries the news. */}
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-background"
        />
      ) : null}
    </span>
  );
}
