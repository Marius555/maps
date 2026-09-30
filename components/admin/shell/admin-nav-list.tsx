"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { SidebarNavItem } from "@/components/layout/sidebar/sidebar-nav-item";
import { ADMIN_NAV } from "./admin-nav";

/**
 * The console's sections, shared by the desktop rail and the mobile drawer.
 * The period travels with every link, so moving between sections keeps it.
 * `useSearchParams` is why both callers wrap this in `Suspense`.
 */
export function AdminNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const range = useSearchParams().get("range");
  const query = range ? `?range=${range}` : "";

  return (
    <nav aria-label="Admin sections">
      <ul className="space-y-0.5">
        {ADMIN_NAV.map((item) => (
          <li key={item.href}>
            <SidebarNavItem
              item={{ ...item, href: `${item.href}${query}` }}
              isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
              isCollapsed={false}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
