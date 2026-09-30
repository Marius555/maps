"use client";

import { Chip } from "@heroui/react";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { formatDate } from "@/lib/admin/format";
import type { SubscriptionTableRow } from "@/lib/admin/metrics/billing";
import { formatEuros } from "@/lib/admin/metrics/revenue";

const COLUMNS: DataColumn<SubscriptionTableRow>[] = [
  {
    id: "account",
    label: "Account",
    isRowHeader: true,
    sortValue: (row) => row.email,
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{row.name || row.email}</p>
        <p className="truncate text-xs text-muted">{row.email}</p>
      </div>
    ),
  },
  { id: "plan", label: "Plan", sortValue: (row) => row.plan, render: (row) => row.plan },
  {
    id: "cadence",
    label: "Billed",
    secondary: true,
    sortValue: (row) => row.cadence,
    render: (row) => row.cadence,
  },
  {
    id: "status",
    label: "Status",
    sortValue: (row) => row.status,
    render: (row) => (
      <Chip size="sm" variant="soft" color={row.paying ? "success" : "default"}>
        {row.status}
      </Chip>
    ),
  },
  {
    id: "renews",
    label: "Period ends",
    numeric: true,
    secondary: true,
    sortValue: (row) => row.currentPeriodEnd ?? "",
    render: (row) => formatDate(row.currentPeriodEnd),
  },
  {
    id: "monthly",
    label: "€ / month",
    numeric: true,
    sortValue: (row) => row.monthly,
    render: (row) => (row.monthly > 0 ? formatEuros(row.monthly) : "—"),
  },
];

export function SubscriptionsTable({ rows }: { rows: SubscriptionTableRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Nobody has bought a plan yet.</p>;
  }

  return (
    <DataTable
      label="Subscriptions"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="monthly"
      visibleRows={10}
    />
  );
}
