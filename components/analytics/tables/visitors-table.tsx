"use client";

import { formatDistanceToNow } from "date-fns";

import { maskIp } from "@/lib/analytics/collect/mask-ip";
import { formatCount } from "@/lib/format/number";
import type { MapSession } from "@/lib/repositories/types";
import { DEVICE_LABELS, labelCountry, NO_REFERRER_LABEL } from "../sections";
import { DataTable, type DataColumn } from "./data-table";

/**
 * The most recent visitors, one row each.
 *
 * **The IP address is masked here and stored whole.** Two different jobs: the
 * stored value is evidence, available to an owner chasing abuse on their own
 * map, and the drawn value answers "is this the same visitor as the row above",
 * which is the only thing a table of recent visits is ever used for and which
 * the masked form answers just as well. The rule itself lives in
 * lib/analytics/collect/mask-ip.ts so that the decision is in one place rather
 * than in whichever component last needed it.
 *
 * This is the one table on the page that reads raw session rows rather than a
 * rollup, so it only ever shows what has not yet aged out of the retention
 * window — which is why it is the last section rather than the first.
 *
 * "When" is relative, because the exact second is never the question; the exact
 * time is in the `title`, so hovering answers it without a column for it.
 */
export function VisitorsTable({ rows }: { rows: MapSession[] }) {
  const columns: DataColumn<MapSession>[] = [
    {
      id: "when",
      label: "When",
      isRowHeader: true,
      sortValue: (row) => row.startedAt,
      render: (row) => (
        <span title={row.startedAt} className="whitespace-nowrap text-foreground">
          {formatDistanceToNow(new Date(row.startedAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      id: "where",
      label: "Where",
      sortValue: (row) => `${row.country ?? "ZZ"}${row.city ?? ""}`,
      render: (row) => (
        <span className="text-foreground">
          {row.city ? `${row.city}, ` : ""}
          {row.country ? labelCountry(row.country) : <span className="text-muted">Unknown</span>}
        </span>
      ),
    },
    {
      id: "ip",
      label: "IP address",
      secondary: true,
      sortValue: (row) => row.ip ?? "",
      render: (row) => (
        <span className="tabular-nums text-muted">{maskIp(row.ip)}</span>
      ),
    },
    {
      id: "device",
      label: "Device",
      secondary: true,
      sortValue: (row) => row.device,
      render: (row) => DEVICE_LABELS[row.device],
    },
    {
      id: "referrer",
      label: "Came from",
      secondary: true,
      sortValue: (row) => row.referrer,
      render: (row) => (
        <span className="text-muted">{hostOf(row.referrer) || NO_REFERRER_LABEL}</span>
      ),
    },
    {
      id: "events",
      label: "Actions",
      numeric: true,
      sortValue: (row) => row.events.length,
      render: (row) => formatCount(row.events.length),
    },
  ];

  return (
    <DataTable
      label="Recent visitors, newest first"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="when"
      limit={25}
    />
  );
}

/** Host only. The full URL is neither ours to display nor useful in a cell. */
function hostOf(referrer: string): string {
  if (!referrer) return "";

  try {
    return new URL(referrer).hostname;
  } catch {
    return "";
  }
}
