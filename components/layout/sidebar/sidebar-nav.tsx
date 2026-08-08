"use client";

import { LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";

import { SidebarMapNav, isItemActive } from "./sidebar-map-nav";
import { SidebarNavItem, type NavItem } from "./sidebar-nav-item";

const ALL_MAPS: NavItem = {
  href: "/maps",
  label: "All maps",
  icon: LayoutGrid,
  // Exact, or it would stay lit while you're inside a single map.
  exact: true,
};

export function SidebarNav({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const mapId = mapIdFromPathname(pathname);

  return (
    <nav aria-label="Main" className="space-y-5">
      <ul>
        <li>
          <SidebarNavItem
            item={ALL_MAPS}
            isActive={isItemActive(pathname, ALL_MAPS)}
            isCollapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        </li>
      </ul>

      {mapId ? (
        <SidebarMapNav
          mapId={mapId}
          pathname={pathname}
          isCollapsed={isCollapsed}
          onNavigate={onNavigate}
        />
      ) : null}
    </nav>
  );
}

/** The map id from any `/maps/<id>/...` route, or null on `/maps` itself. */
function mapIdFromPathname(pathname: string): string | null {
  return pathname.match(/^\/maps\/([^/]+)/)?.[1] ?? null;
}
