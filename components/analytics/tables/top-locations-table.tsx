"use client";

import Link from "next/link";

import { formatCount } from "@/lib/format/number";
import type { PlaceRow } from "@/lib/analytics/view";
import { StatBar } from "../stat-bar";
import { DataTable, type DataColumn } from "./data-table";

/**
 * Which locations visitors actually looked at.
 *
 * The answer to "on which location did users click the most", and the table this
 * page exists for. Ranked by cards opened rather than by pin clicks, because a
 * card opens however the visitor got there — the map, the results list, a deep
 * link — and "how many people looked at this shop" is one question, not three.
 * The two routes are still there as their own columns for anyone who wants to
 * know whether their panel or their map is doing the work.
 *
 * **Only locations somebody touched.** A three-hundred-row table of zeroes
 * answers nothing, and the inverse question — which locations nobody looks at —
 * belongs on the Locations page beside the locations themselves.
 *
 * A location the map no longer has keeps its row, named as missing rather than
 * dropped: dangling ids are the normal state in this codebase (§0), and silently
 * removing the row would leave the tiles above counting opens the table cannot
 * account for.
 */
export function TopLocationsTable({
  mapId,
  rows,
}: {
  mapId: string;
  rows: PlaceRow[];
}) {
  const busiest = rows.reduce((most, row) => Math.max(most, row.open), 0);

  const columns: DataColumn<PlaceRow>[] = [
    {
      id: "name",
      label: "Location",
      isRowHeader: true,
      sortValue: (row) => row.name,
      render: (row) =>
        row.exists ? (
          <Link
            href={`/maps/${mapId}/places?place=${row.id}`}
            className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-current"
          >
            {row.name}
          </Link>
        ) : (
          // Not a link: it goes nowhere, and this page follows the rule that a
          // row links only where the link is useful.
          <span className="text-muted italic">{row.name}</span>
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
      id: "share",
      label: "Share",
      sortable: false,
      render: (row) => (
        // Against the busiest location rather than the total: this is a ranked
        // list, and on a map with three hundred locations a share of the whole
        // would draw every bar as an empty track.
        <StatBar share={busiest > 0 ? row.open / busiest : 0} />
      ),
    },
    {
      id: "directions",
      label: "Directions",
      numeric: true,
      sortValue: (row) => row.directions,
      render: (row) => formatCount(row.directions),
    },
    {
      id: "tel",
      label: "Calls",
      numeric: true,
      secondary: true,
      sortValue: (row) => row.tel,
      render: (row) => formatCount(row.tel),
    },
    {
      id: "site",
      label: "Website",
      numeric: true,
      secondary: true,
      sortValue: (row) => row.site,
      render: (row) => formatCount(row.site),
    },
  ];

  return (
    <DataTable
      label="Locations visitors opened, busiest first"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="open"
    />
  );
}
