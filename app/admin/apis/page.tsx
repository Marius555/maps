import { Chip } from "@heroui/react";
import type { Metadata } from "next";

import { SourceBadge } from "@/components/admin/kpi/source-badge";
import { ApisTraffic } from "@/components/admin/sections/apis/apis-traffic";
import { BudgetCard } from "@/components/admin/sections/apis/budget-card";
import { EndpointsTable } from "@/components/admin/sections/apis/endpoints-table";
import { SpendersTable } from "@/components/admin/sections/apis/spenders-table";
import { AdminToolbar } from "@/components/admin/shell/admin-toolbar";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { loadApisMetrics } from "@/lib/admin/metrics/apis";
import { counted } from "@/lib/admin/source";
import { parseAdminRange } from "@/lib/validation/admin.schema";

export const metadata: Metadata = { title: "APIs" };

/**
 * The figures and their shape, today's budget, then the two tables. The
 * breakdowns by provider, by kind and by outcome are the Endpoints table's
 * rows and columns, so they are not also drawn as charts. A table with no rows
 * is not drawn, nor is the traffic card when nothing was asked of anyone.
 */
export default async function AdminApisPage(props: PageProps<"/admin/apis">) {
  await requireAdminPage();

  const range = parseAdminRange((await props.searchParams).range);
  const metrics = await loadApisMetrics(range);
  const hasTraffic = metrics.calls.value > 0 || metrics.lookups.value > 0;
  const tables = [metrics.endpoints.length > 0, metrics.spenders.length > 0].filter(Boolean).length;

  return (
    <>
      <AdminToolbar
        range={range}
        meta={
          <>
            <Chip size="sm" variant="soft">
              Geocoding: {metrics.active.geocoder}
            </Chip>
            <Chip size="sm" variant="soft">
              Routing: {metrics.active.router}
            </Chip>
          </>
        }
      />

      <div className={hasTraffic ? "grid gap-4 xl:grid-cols-3" : ""}>
        {hasTraffic ? (
          <div className="min-w-0 xl:col-span-2">
            <ApisTraffic metrics={metrics} />
          </div>
        ) : null}
        <BudgetCard pool={metrics.pool} />
      </div>

      {tables > 0 ? (
        <div className={tables === 2 ? "grid gap-4 xl:grid-cols-2" : ""}>
          {metrics.endpoints.length > 0 ? (
            <SectionCard
              title="Endpoints"
              action={<SourceBadge source={counted("Requests and error rate per provider and kind, from our request counter.")} />}
            >
              <EndpointsTable rows={metrics.endpoints} />
            </SectionCard>
          ) : null}
          {metrics.spenders.length > 0 ? (
            <SectionCard
              title="Top spenders this month"
              action={
                <SourceBadge
                  source={counted(`Lookups against each account's allowance for ${metrics.month}, from our usage meter.`)}
                />
              }
            >
              <SpendersTable rows={metrics.spenders} />
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
