"use client";

import { formatCount } from "@/lib/format/number";
import type { LabelledCount } from "@/lib/analytics/view";
import { StatBar } from "../stat-bar";
import { DataTable, type DataColumn } from "./data-table";

/**
 * Towns visitors went to that have no location in them.
 *
 * **The one table here that answers a question about the business rather than
 * about the map.** A visitor only ever reaches this list by typing something the
 * map could not match and then picking a *place* out of the suggestions
 * instead — so every row is somebody who wanted a location somewhere there is
 * not one, and a month of them is a ranked list of where the demand is.
 *
 * That is a different fact from the searches table above it, and the difference
 * is worth keeping straight: a search with no matches might be a misspelling, a
 * street, or a shop that closed. Picking the town of Kaunas out of a list is
 * unambiguous — the person knew where they meant.
 *
 * These are place names from our own gazetteer, not visitors' typing, so unlike
 * the searches table there is nothing here a visitor authored.
 */
export function PicksTable({ rows }: { rows: LabelledCount[] }) {
  const busiest = rows.reduce((most, row) => Math.max(most, row.count), 0);

  const columns: DataColumn<LabelledCount>[] = [
    {
      id: "key",
      label: "Place",
      isRowHeader: true,
      sortValue: (row) => row.key,
      render: (row) => <span className="text-foreground">{row.key}</span>,
    },
    {
      id: "count",
      label: "Visitors",
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
      label="Places visitors went to from the search box, most wanted first"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      initialSort="count"
      limit={15}
    />
  );
}
