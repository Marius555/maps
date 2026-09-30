import { Alert } from "@heroui/react";
import type { Metadata } from "next";

import { AdminEmpty } from "@/components/admin/kpi/admin-empty";
import { SourceBadge } from "@/components/admin/kpi/source-badge";
import { EmailTable } from "@/components/admin/sections/email/email-table";
import { EmailTraffic } from "@/components/admin/sections/email/email-traffic";
import { AdminToolbar } from "@/components/admin/shell/admin-toolbar";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { loadEmailMetrics } from "@/lib/admin/metrics/email";
import { api } from "@/lib/admin/source";
import { parseAdminRange } from "@/lib/validation/admin.schema";

export const metadata: Metadata = { title: "Email" };

/** The figures with their shape, then every send — or one line when there were none. */
export default async function AdminEmailPage(props: PageProps<"/admin/email">) {
  await requireAdminPage();

  const range = parseAdminRange((await props.searchParams).range);
  const metrics = await loadEmailMetrics(range);

  return (
    <>
      <AdminToolbar range={range} />

      {metrics.configured ? null : (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>RESEND_API_KEY is not set</Alert.Title>
            <Alert.Description>
              Nothing is being sent. Each attempt is still logged, as “No API key”.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {metrics.recent.length > 0 ? (
        <>
          <EmailTraffic metrics={metrics} />

          <SectionCard
            title="Recent emails"
            action={
              <SourceBadge
                source={api("Our log of each send with Resend's reply. Addresses are stored masked; times are UTC.")}
              />
            }
          >
            <EmailTable rows={metrics.recent} />
          </SectionCard>
        </>
      ) : (
        <AdminEmpty>{`No emails in the last ${String(range)} days.`}</AdminEmpty>
      )}
    </>
  );
}
