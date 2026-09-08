"use client";

import { formatCount } from "@/lib/format/number";
import type { AnalyticsView, LabelledCount, PageRow } from "@/lib/analytics/view";
import { DEVICE_LABELS, labelCountry, NO_REFERRER_LABEL } from "../sections";
import { StatBar } from "../stat-bar";
import { DataTable, type DataColumn } from "./data-table";

/**
 * Who the visitors are and where they came from: three short tables that answer
 * three different questions and are read side by side.
 *
 * They are separate tables rather than sections of one, unlike the content stats
 * this page replaced. That page shared a table so its Share column would line up
 * across seven sections and could be compared. Here comparison across the three
 * is meaningless — a country is not comparable to a device — and each is short
 * enough to be read whole, so three side by side is three answers in one glance
 * instead of one column of twenty rows.
 */

export function CountriesTable({ rows }: { rows: LabelledCount[] }) {
  return (
    <ShareTable
      label="Where visitors are, by country"
      rows={rows}
      name={labelCountry}
      countLabel="Visits"
      firstLabel="Country"
    />
  );
}

export function DevicesTable({ rows }: { rows: AnalyticsView["devices"] }) {
  return (
    <ShareTable
      label="What visitors are using"
      rows={rows.map((row) => ({ key: row.kind, count: row.count }))}
      name={(key) => DEVICE_LABELS[key as keyof typeof DEVICE_LABELS] ?? key}
      countLabel="Visits"
      firstLabel="Device"
    />
  );
}

/**
 * Where visitors were before the customer's page.
 *
 * Sessions with no referrer are a row rather than an omission, because they are
 * the biggest group on most store locators — somebody already on the site,
 * clicking through from a page whose referrer policy passed nothing. Leaving
 * them out would make the column not add up to the visits above it.
 */
export function ReferrersTable({
  rows,
  direct,
}: {
  rows: LabelledCount[];
  direct: number;
}) {
  const all = direct > 0 ? [...rows, { key: "", count: direct }] : rows;

  return (
    <ShareTable
      label="Where visitors came from"
      rows={all}
      name={(key) => key || NO_REFERRER_LABEL}
      countLabel="Visits"
      firstLabel="Came from"
    />
  );
}

/** Which of the customer's own pages the map is on. */
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
      limit={10}
    />
  );
}

/** The shape all three audience tables share: a name, a count, a bar. */
function ShareTable({
  label,
  rows,
  name,
  countLabel,
  firstLabel,
}: {
  label: string;
  rows: LabelledCount[];
  name: (key: string) => string;
  countLabel: string;
  firstLabel: string;
}) {
  const busiest = rows.reduce((most, row) => Math.max(most, row.count), 0);

  const columns: DataColumn<LabelledCount>[] = [
    {
      id: "key",
      label: firstLabel,
      isRowHeader: true,
      sortValue: (row) => name(row.key),
      render: (row) => <span className="text-foreground">{name(row.key)}</span>,
    },
    {
      id: "count",
      label: countLabel,
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
      label={label}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key || "none"}
      initialSort="count"
      limit={10}
    />
  );
}
