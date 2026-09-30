"use client";

import { Meter } from "@heroui/react";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { PLAN_COLOR } from "@/lib/admin/colors";
import { formatPercent } from "@/lib/admin/format";
import type { SpenderRow } from "@/lib/admin/metrics/apis";
import { formatCount } from "@/lib/format/number";

const PLAN_LABEL: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };

/** Colour follows how close the account is to its ceiling; the percentage says it too. */
function tone(share: number): "danger" | "warning" | "success" {
  if (share >= 1) return "danger";
  if (share >= 0.8) return "warning";
  return "success";
}

const COLUMNS: DataColumn<SpenderRow>[] = [
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
  {
    id: "plan",
    label: "Plan",
    secondary: true,
    sortValue: (row) => row.plan,
    render: (row) => (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: PLAN_COLOR[row.plan] }} />
        {PLAN_LABEL[row.plan]}
      </span>
    ),
  },
  {
    id: "lookups",
    label: "Lookups",
    numeric: true,
    sortValue: (row) => row.lookups,
    render: (row) => `${formatCount(row.lookups)} / ${formatCount(row.limit)}`,
  },
  {
    id: "share",
    label: "Of allowance",
    sortValue: (row) => row.lookups / row.limit,
    render: (row) => {
      const share = row.lookups / Math.max(1, row.limit);

      return (
        <Meter
          aria-label={`${row.email}: share of monthly allowance`}
          value={Math.min(row.lookups, row.limit)}
          maxValue={Math.max(1, row.limit)}
          color={tone(share)}
          size="sm"
          valueLabel={formatPercent(share)}
          className="min-w-28 items-center gap-x-2 [grid-template-areas:'track_output']"
        >
          <Meter.Track>
            <Meter.Fill />
          </Meter.Track>
          <Meter.Output className="w-10 text-right text-xs font-normal text-muted" />
        </Meter>
      );
    },
  },
];

export function SpendersTable({ rows }: { rows: SpenderRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No account has spent a lookup this month.</p>;
  }

  return (
    <DataTable
      label="Top accounts by lookups"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.userId}
      initialSort="lookups"
      visibleRows={8}
    />
  );
}
