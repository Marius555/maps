"use client";

import { BookOpen, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";

import { SidebarMapNav, isItemActive } from "./sidebar-map-nav";
import { SidebarNavItem, type NavItem } from "./sidebar-nav-item";

const GLOBAL_ITEMS: NavItem[] = [
  {
    href: "/maps",
    label: "All maps",
    icon: LayoutGrid,
    // Exact, or it would stay lit while you're inside a single map.
    exact: true,
  },
  {
    href: "/docs",
    label: "Documentation",
    icon: BookOpen,
    // Not exact: `/docs/importing-locations` is still the guides, so the row
    // should stay lit inside them.
    newTab: true,
  },
];

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
      <ul className="space-y-0.5">
        {GLOBAL_ITEMS.map((item) => (
          <li key={item.href}>
            <SidebarNavItem
              item={item}
              isActive={isItemActive(pathname, item)}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          </li>
        ))}
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
