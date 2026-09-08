"use client";

import {
  ChartColumn,
  LayoutTemplate,
  MapIcon,
  MapPin,
  Settings,
  Share2,
} from "lucide-react";

import { useMap } from "@/lib/query/maps";
import { SidebarGroupLabel } from "./sidebar-group-label";
import { SidebarNavItem, type NavItem } from "./sidebar-nav-item";

/**
 * The nav for the map you're currently inside.
 *
 * This group replaces what used to be a second row of tabs stacked under the
 * navbar. Everything it needs is in the URL, so it lives in the dashboard shell
 * rather than the map layout — which is what keeps the shell mounted across
 * navigations, so switching sections swaps only the page body.
 *
 * The map name is read from the query cache. On a cold load of the Map tab that
 * costs one small `/api/maps/[id]` request; every other section has already
 * primed the cache, and react-query dedupes it either way. It's a dashboard
 * request, never a visitor one, so CLAUDE.md §2 is unaffected.
 */
export function SidebarMapNav({
  mapId,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  mapId: string;
  pathname: string;
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const { data: map } = useMap(mapId);

  const items: NavItem[] = [
    { href: `/maps/${mapId}`, label: "Map", icon: MapIcon, exact: true },
    { href: `/maps/${mapId}/places`, label: "Locations", icon: MapPin },
    // After Locations, because the card is what a location looks like — you
    // have to have some before designing what they show.
    { href: `/maps/${mapId}/card`, label: "Card", icon: LayoutTemplate },
    { href: `/maps/${mapId}/publish`, label: "Publish", icon: Share2 },
    // After Publish, because it reports on the map rather than changing it —
    // and before Settings, which is where you go to change how it works.
    { href: `/maps/${mapId}/analytics`, label: "Analytics", icon: ChartColumn },
    { href: `/maps/${mapId}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <div>
      {/* No placeholder label while the name loads — a flash of "Loading…" that
          becomes the map name is worse than the label simply appearing. */}
      {map ? (
        <SidebarGroupLabel isCollapsed={isCollapsed}>{map.name}</SidebarGroupLabel>
      ) : null}

      <ul className="space-y-0.5">
        {items.map((item) => (
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
    </div>
  );
}

export function isItemActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
