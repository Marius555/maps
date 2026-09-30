"use client";

import { Chip } from "@heroui/react";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { formatDate } from "@/lib/admin/format";
import type { MapTableRow } from "@/lib/admin/metrics/content";
import { formatCount } from "@/lib/format/number";

const COLUMNS: DataColumn<MapTableRow>[] = [
  {
    id: "map",
    label: "Map",
    isRowHeader: true,
    sortValue: (row) => row.name,
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{row.name}</p>
        <p className="truncate text-xs text-muted">{row.owner}</p>
      </div>
    ),
  },
  {
    id: "places",
    label: "Locations",
    numeric: true,
    sortValue: (row) => row.places,
    render: (row) => formatCount(row.places),
  },
  {
    id: "published",
    label: "Published",
    sortValue: (row) => row.publishedAt ?? "",
    render: (row) =>
      row.publishedAt ? (
        <Chip size="sm" variant="soft" color="success">
          {formatDate(row.publishedAt)}
        </Chip>
      ) : (
        <Chip size="sm" variant="soft" color="default">
          Draft
        </Chip>
      ),
  },
  {
    id: "created",
    label: "Created",
    numeric: true,
    secondary: true,
    sortValue: (row) => row.createdAt,
    render: (row) => formatDate(row.createdAt),
  },
];

export function MapsTable({ rows }: { rows: MapTableRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No maps yet.</p>;
  }

  return (
    <DataTable
      label="Newest maps"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="created"
      visibleRows={10}
    />
  );
}
