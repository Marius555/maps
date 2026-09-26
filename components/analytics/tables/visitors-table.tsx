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
 * **The IP address is masked here, and truncated before it is stored.** New rows
 * keep only the network (lib/analytics/collect/truncate-ip.ts); rows from
 * before that change hold the full address, and masking both at render means
 * the column reads the same either way. The rule lives in
 * lib/analytics/collect/mask-ip.ts so the decision is in one place rather than
 * in whichever component last needed it. "Visitor" answers the question the
 * masked address used to be squinted at for — is this somebody who has been
 * here before — directly.
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
      id: "visitor",
      label: "Visitor",
      secondary: true,
      sortValue: (row) => (row.visitor ? (row.returning ? 2 : 1) : 0),
      render: (row) =>
        // A row from before visitor counting, or with no address to key on,
        // is neither new nor returning — it is unknown, and says so.
        row.visitor ? (
          <span className={row.returning ? "text-foreground" : "text-muted"}>
            {row.returning ? "Returning" : "New"}
          </span>
        ) : (
          <span className="text-muted">—</span>
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
      visibleRows={10}
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
