import type { Metadata } from "next";

import { OverviewGrowth } from "@/components/admin/sections/overview/overview-growth";
import { OverviewNow } from "@/components/admin/sections/overview/overview-now";
import { RecentSignupsCard } from "@/components/admin/sections/overview/recent-signups-card";
import { AdminToolbar } from "@/components/admin/shell/admin-toolbar";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { loadOverviewMetrics } from "@/lib/admin/metrics/overview";
import { parseAdminRange } from "@/lib/validation/admin.schema";

export const metadata: Metadata = { title: "Overview" };

/**
 * Three blocks: where things stand today, how the period moved, and who just
 * arrived. Each section's page has the rest. The growth card and the signups
 * list each drop out when they have nothing to show, so the grid is only split
 * when both are there.
 */
export default async function AdminOverviewPage(props: PageProps<"/admin">) {
  await requireAdminPage();

  const range = parseAdminRange((await props.searchParams).range);
  const metrics = await loadOverviewMetrics(range);
  const hasSignups = metrics.recentSignups.length > 0;

  return (
    <>
      <AdminToolbar range={range} />
      <OverviewNow metrics={metrics} />
      <div className={hasSignups ? "grid gap-4 xl:grid-cols-3" : ""}>
        <div className="min-w-0 xl:col-span-2">
          <OverviewGrowth metrics={metrics} />
        </div>
        <RecentSignupsCard users={metrics.recentSignups} />
      </div>
    </>
  );
}
