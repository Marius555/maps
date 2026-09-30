import type { Metadata } from "next";

import { AdminMobileNav } from "@/components/admin/shell/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/shell/admin-sidebar";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { template: "%s · Admin", default: "Admin" },
  robots: { index: false, follow: false },
};

/**
 * The operator console's chrome. Guards the first load; it is not the only
 * guard — a layout does not re-render on a client navigation, so every page's
 * loader checks again (`lib/admin/auth/guard.ts`).
 *
 * **The customer shell's frame** (`AppShell`): exactly one viewport tall, with
 * `<main>` the only scroller, so the rail and its account menu stay on screen
 * however long the page. `data-app-frame` stops the root reserving a scrollbar
 * gutter it can never use, and `relative` on `<main>` keeps `sr-only` spans
 * from making the document scroll — both argued in `AppShell`.
 *
 * The guard here is a cookie check and nothing more, so the shell and
 * `loading.tsx` stream at once and the metrics arrive inside the console
 * rather than behind a login form that looks frozen.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdminPage();

  return (
    <div data-app-frame="" className="flex h-[100dvh] min-h-0 flex-none overflow-hidden">
      <AdminSidebar email={env.adminEmail} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminMobileNav email={env.adminEmail} />
        <main className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
