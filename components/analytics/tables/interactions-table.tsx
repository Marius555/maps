"use client";

import { formatCount } from "@/lib/format/number";
import type { LabelledCount } from "@/lib/analytics/view";
import { labelEvent } from "../sections";
import { StatBar } from "../stat-bar";
import { DataTable, type DataColumn } from "./data-table";

/**
 * Everything visitors pressed, and how often.
 *
 * The answer to "how many times did users click this particular button" — every
 * control the embed has, in one column that can be run down with the eye. Zoom,
 * fullscreen, find-nearest, cluster expansion, the photo gallery, the folds that
 * hide the hours and the description, and every link on a card.
 *
 * **Map loads are not in here.** They are the denominator, they are already the
 * headline figure above, and leaving them in would put one bar at 100% and
 * squash everything this table exists to compare.
 *
 * Rows are labelled by `labelEvent`, which falls back to the raw key for an
 * event this build has not heard of. That is not a gap to close: the embed ships
 * on customers' pages and updates when their visitors reload, so a newer one can
 * legitimately send something this dashboard predates. An unlabelled figure is a
 * small ugliness; a missing one is a lie about what visitors did.
 */
export function InteractionsTable({ rows }: { rows: LabelledCount[] }) {
  const busiest = rows.reduce((most, row) => Math.max(most, row.count), 0);

  const columns: DataColumn<LabelledCount>[] = [
    {
      id: "key",
      label: "What they did",
      isRowHeader: true,
      sortValue: (row) => labelEvent(row.key),
      render: (row) => (
        <span className="text-foreground">{labelEvent(row.key)}</span>
      ),
    },
    {
      id: "count",
      label: "Times",
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
      label="What visitors did, most frequent first"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      initialSort="count"
      limit={30}
    />
  );
}
