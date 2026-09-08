"use client";

import { formatCount } from "@/lib/format/number";
import type { SearchRow } from "@/lib/analytics/view";
import { StatBar } from "../stat-bar";
import { DataTable, type DataColumn } from "./data-table";

/**
 * What visitors typed into the search box.
 *
 * **The most valuable table on this page**, and the reason the embed reports a
 * match count beside every query rather than just the words. "Sixty people
 * searched Kaunas" is a statistic. "Sixty people searched Kaunas and found
 * nothing" is the customer's next shop, or at least the town they should add a
 * stockist in — and it is a thing no other tool of theirs can tell them, because
 * the search happens entirely inside a map on their own site.
 *
 * So the zero-match rows are called out rather than left for the reader to spot
 * in a column of numbers. Not with colour alone: the row says "Nothing found" in
 * words, which is what survives forced-colors mode and a monochrome print.
 *
 * The queries are visitors' own words, and they are shown as typed. They are
 * rendered as text and never as markup — `DataTable` puts them through React,
 * so there is no path from a search box on a stranger's site to markup here.
 */
export function SearchesTable({ rows }: { rows: SearchRow[] }) {
  const busiest = rows.reduce((most, row) => Math.max(most, row.count), 0);

  const columns: DataColumn<SearchRow>[] = [
    {
      id: "query",
      label: "What they searched for",
      isRowHeader: true,
      sortValue: (row) => row.query,
      render: (row) => <span className="text-foreground">{row.query}</span>,
    },
    {
      id: "count",
      label: "Searches",
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
    {
      id: "matches",
      label: "Found",
      numeric: true,
      // Ascending first would be the useful default here, but the table sorts
      // descending on whatever you press; the zero rows are called out in words
      // instead, which works without anybody sorting anything.
      sortValue: (row) => row.matches,
      render: (row) =>
        row.matches > 0 ? (
          <span>{formatCount(row.matches)}</span>
        ) : (
          <span style={{ color: "var(--warning-ink)" }}>Nothing found</span>
        ),
    },
  ];

  return (
    <DataTable
      label="Search terms visitors typed, most searched first"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.query}
      initialSort="count"
    />
  );
}
