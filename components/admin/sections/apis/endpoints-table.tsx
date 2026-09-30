"use client";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { PROVIDER_COLOR } from "@/lib/admin/colors";
import { formatPercent } from "@/lib/admin/format";
import type { EndpointRow } from "@/lib/admin/metrics/apis";
import { formatCount } from "@/lib/format/number";

const PROVIDER_LABEL: Record<string, string> = {
  geoapify: "Geoapify",
  photon: "Photon",
  osrm: "OSRM",
};

const COLUMNS: DataColumn<EndpointRow>[] = [
  {
    id: "endpoint",
    label: "Request",
    isRowHeader: true,
    sortValue: (row) => row.key,
    render: (row) => (
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: PROVIDER_COLOR[row.provider] }}
        />
        <span className="text-foreground">{PROVIDER_LABEL[row.provider] ?? row.provider}</span>
        <span className="text-muted">· {row.kind}</span>
      </span>
    ),
  },
  {
    id: "total",
    label: "Requests",
    numeric: true,
    sortValue: (row) => row.ok + row.failed,
    render: (row) => formatCount(row.ok + row.failed),
  },
  {
    id: "failed",
    label: "Failed",
    numeric: true,
    sortValue: (row) => row.failed,
    render: (row) => formatCount(row.failed),
  },
  {
    id: "rate",
    label: "Error rate",
    numeric: true,
    sortValue: (row) => row.errorRate,
    render: (row) => (
      <span className={row.errorRate >= 0.05 ? "font-medium text-danger" : undefined}>
        {formatPercent(row.errorRate)}
      </span>
    ),
  },
];

export function EndpointsTable({ rows }: { rows: EndpointRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No requests in this period.</p>;
  }

  return (
    <DataTable
      label="Requests by endpoint"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.key}
      initialSort="total"
      visibleRows={8}
    />
  );
}
