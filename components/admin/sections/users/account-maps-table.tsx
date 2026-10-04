"use client";

import { Chip } from "@heroui/react";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { formatDate } from "@/lib/admin/format";
import type { AccountMapRow, Usage } from "@/lib/admin/metrics/account";
import { formatCount } from "@/lib/format/number";

/**
 * "12 / 25", in the danger colour and with the word "over" when past the limit —
 * said in words as well as colour, so it reads without either.
 */
function UsageCell({ usage }: { usage: Usage }) {
  return (
    <span className={usage.over ? "font-medium text-danger" : undefined}>
      {formatCount(usage.used)} / {formatCount(usage.limit)}
      {usage.over ? <span className="ml-1 text-xs">over</span> : null}
    </span>
  );
}

const COLUMNS: DataColumn<AccountMapRow>[] = [
  {
    id: "map",
    label: "Map",
    isRowHeader: true,
    sortValue: (row) => row.name,
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{row.name}</p>
        <p className="truncate text-xs text-muted">
          {row.withinMapAllowance ? "Created" : "Past the plan's map count · created"}{" "}
          {formatDate(row.createdAt)}
        </p>
      </div>
    ),
  },
  {
    id: "state",
    label: "Publish",
    sortValue: (row) => (row.over ? 1 : 0),
    render: (row) =>
      row.over ? (
        <Chip size="sm" variant="soft" color="danger">
          Refused
        </Chip>
      ) : (
        <Chip size="sm" variant="soft" color={row.publishedAt ? "success" : "default"}>
          {row.publishedAt ? "Live" : "Draft"}
        </Chip>
      ),
  },
  {
    id: "places",
    label: "Locations",
    numeric: true,
    sortValue: (row) => row.places.used,
    render: (row) => <UsageCell usage={row.places} />,
  },
  {
    id: "shapes",
    label: "Shapes",
    numeric: true,
    sortValue: (row) => row.shapes.used,
    render: (row) => <UsageCell usage={row.shapes} />,
  },
  {
    id: "sessions",
    label: "Sessions this month",
    numeric: true,
    secondary: true,
    sortValue: (row) => row.sessions.used,
    render: (row) => <UsageCell usage={row.sessions} />,
  },
  {
    id: "groups",
    label: "Groups",
    numeric: true,
    secondary: true,
    sortValue: (row) => row.groups,
    render: (row) => formatCount(row.groups),
  },
  {
    id: "sheet",
    label: "Sheet sync",
    secondary: true,
    sortValue: (row) => (row.sheetAutoSync === null ? 0 : row.sheetAutoSync ? 2 : 1),
    render: (row) =>
      row.sheetAutoSync === null ? "—" : row.sheetAutoSync ? "Linked, auto" : "Linked",
  },
];

export function AccountMapsTable({ maps }: { maps: AccountMapRow[] }) {
  return (
    <DataTable
      label="Maps"
      columns={COLUMNS}
      rows={maps}
      rowKey={(row) => row.id}
      initialSort="places"
      visibleRows={15}
    />
  );
}
