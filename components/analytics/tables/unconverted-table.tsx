"use client";

import Link from "next/link";

import { formatCount } from "@/lib/format/number";
import type { PlaceRow } from "@/lib/analytics/view";
import { DataTable, type DataColumn } from "./data-table";

/**
 * Locations people opened and then did nothing with.
 *
 * **The most actionable table on this page**, and the only one that names a
 * specific thing to go and fix rather than describing what happened. Interest is
 * not the problem for these rows: somebody found the location, opened its card,
 * read it — and then did not ask for directions, did not call, did not open the
 * website. Whatever the card said, it was not worth acting on.
 *
 * In practice it is nearly always one of three things, which is why the hint
 * says so: no phone number on the card, hours that read as closed, or an address
 * that looks wrong enough to distrust. All three are one edit away, which is
 * what makes this worth a section of its own instead of a column on the table
 * above.
 *
 * Ranked by opens, because ninety opens with nothing to show for them is a
 * finding and two is a sample size. The row links to the location's own editor,
 * because "go and look at this card" is the entire point of the table.
 */
export function UnconvertedTable({
  mapId,
  rows,
}: {
  mapId: string;
  rows: PlaceRow[];
}) {
  const columns: DataColumn<PlaceRow>[] = [
    {
      id: "name",
      label: "Location",
      isRowHeader: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <Link
          href={`/maps/${mapId}/places?place=${row.id}`}
          className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-current"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "open",
      label: "Opened",
      numeric: true,
      sortValue: (row) => row.open,
      render: (row) => formatCount(row.open),
    },
    {
      /*
       * A column of zeroes, deliberately.
       *
       * Every row here has none of these by definition, so the number carries no
       * information — the *heading* does. Without it the table reads as a second
       * ranking of popular locations, which is the opposite of what it says.
       */
      id: "actions",
      label: "Directions, calls or clicks",
      numeric: true,
      sortable: false,
      render: () => <span className="text-muted">0</span>,
    },
  ];

  return (
    <DataTable
      label="Locations opened that produced no directions, call or website visit"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="open"
      limit={10}
    />
  );
}
