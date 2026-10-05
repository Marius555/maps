import { ScrollShadow } from "@heroui/react";
import Link from "next/link";
import { Suspense } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { AdminAccountMenu } from "./admin-account-menu";
import { AdminBadge } from "./admin-badge";
import { AdminNavList } from "./admin-nav-list";
import { AdminVersion } from "./admin-version";

/**
 * The console's rail from `md` up; `AdminMobileNav` below it.
 *
 * **Built from the customer sidebar's parts** (`components/layout/sidebar`):
 * the same width, border and header height, `SidebarNavItem` rows, and the
 * account menu in the footer. It does not collapse — seven rows and one person
 * do not earn the cookie and the shortcut the customer rail carries.
 */
export function AdminSidebar({ email }: { email: string }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border md:flex">
      <div className="flex min-h-14 items-center gap-2 px-3.5">
        <Link
          href="/admin"
          className="min-w-0 truncate whitespace-nowrap text-sm font-semibold tracking-tight text-foreground"
        >
          <BrandLogo />
        </Link>
        <AdminBadge />
      </div>

      <ScrollShadow className="min-h-0 flex-1 px-2 py-2" hideScrollBar>
        <Suspense>
          <AdminNavList />
        </Suspense>
      </ScrollShadow>

      <div className="p-2">
        <AdminAccountMenu email={email} />
        <AdminVersion />
      </div>
    </aside>
  );
}
