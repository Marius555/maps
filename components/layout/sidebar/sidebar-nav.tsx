"use client";

import { BookOpen, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useSidebar } from "./sidebar-context";
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
  const { lastMapId, rememberMap } = useSidebar();

  /*
   * The map in the URL, or failing that the one the layout chose — the last
   * opened if this account owns it, else its most recently edited (see
   * `sidebarMapId`). The group used to exist only under `/maps/<id>`, so
   * stepping out to Account emptied the sidebar down to two rows; now a
   * signed-in owner with a map always has its section, and going back into it
   * is one press rather than two.
   */
  const urlMapId = mapIdFromPathname(pathname);
  const mapId = urlMapId ?? lastMapId;

  useEffect(() => {
    if (urlMapId && urlMapId !== lastMapId) rememberMap(urlMapId);
  }, [urlMapId, lastMapId, rememberMap]);

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
          remembered={urlMapId === null}
          onGone={() => rememberMap(null)}
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
