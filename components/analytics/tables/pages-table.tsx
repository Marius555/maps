"use client";

import { formatCount } from "@/lib/format/number";
import type { PageRow } from "@/lib/analytics/view";
import { StatBar } from "../stat-bar";
import { DataTable, type DataColumn } from "./data-table";

/**
 * Which of the customer's own pages the map is on.
 *
 * The one audience breakdown still drawn as a table: a page is a long URL, and
 * the question is "which page", read down a column. Countries and referrers are
 * a donut and a bar chart now (`panels/audience-panel.tsx`), because the
 * question there is proportion.
 */
export function PagesTable({ rows }: { rows: PageRow[] }) {
  const busiest = rows.reduce((most, row) => Math.max(most, row.count), 0);

  const columns: DataColumn<PageRow>[] = [
    {
      id: "page",
      label: "Page",
      isRowHeader: true,
      sortValue: (row) => `${row.host}${row.path}`,
      render: (row) => (
        <span className="text-foreground">
          {row.host}
          <span className="text-muted">{row.path}</span>
        </span>
      ),
    },
    {
      id: "count",
      label: "Visits",
      numeric: true,
      sortValue: (row) => row.count,
      render: (row) => formatCount(row.count),
    },
    {
      id: "share",
      label: "Share",
      sortable: false,
      render: (row) => <StatBar share={busiest > 0 ? row.count / busiest : 0} />,
    },
  ];

  return (
    <DataTable
      label="Which of your pages the map is on"
      columns={columns}
      rows={rows}
      rowKey={(row) => `${row.host}${row.path}`}
      initialSort="count"
      visibleRows={8}
    />
  );
}
