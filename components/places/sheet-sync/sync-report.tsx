"use client";

import { Button } from "@heroui/react";

import { describeSyncCounts } from "@/lib/sheet-sync/describe";
import type {
  SheetSyncReport,
  SheetSyncStatus,
} from "@/lib/sheet-sync/types";

/**
 * How the last sync went: the counts, any sentence it left, and the rows it
 * could not use.
 *
 * The skipped rows are listed by sheet row number, because the fix for every
 * one of them is in the sheet — "row 14: we couldn't find this address" is
 * something to go and change; "1 row skipped" is not.
 *
 * **A sync that wants to remove most of the map stops and asks here**, with the
 * count in the button, so confirming is a decision about a number rather than a
 * click through a warning.
 */
export function SyncReport({
  status,
  report,
  isSyncing,
  onConfirmRemovals,
}: {
  status: SheetSyncStatus | null;
  report: SheetSyncReport | null;
  isSyncing: boolean;
  onConfirmRemovals: () => void;
}) {
  // A link fresh from its import has no report of its own — the import was its
  // first sync, and the line above already says when that was.
  if (!status || !report) return null;

  return (
    <div className="space-y-2">
      {status === "ok" || status === "partial" ? (
        <p className="text-xs text-foreground">
          {describeSyncCounts(report)}
          {report.republished ? " · live map republished" : ""}
        </p>
      ) : null}

      {report.message ? (
        <p
          className={`text-pretty text-xs ${
            status === "failed" ? "text-danger" : "text-muted"
          }`}
          role={status === "failed" ? "alert" : undefined}
        >
          {report.message}
        </p>
      ) : null}

      {status === "needs_confirmation" && report.pendingRemovals ? (
        <Button
          size="sm"
          variant="danger-soft"
          className="w-full sm:w-auto"
          isPending={isSyncing}
          onPress={onConfirmRemovals}
        >
          Remove {report.pendingRemovals} and sync
        </Button>
      ) : null}

      {report.skippedTotal > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            {report.skippedTotal} {report.skippedTotal === 1 ? "row" : "rows"} not
            on the map
          </p>

          <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {report.skipped.map((skip) => (
              <li key={`${skip.row}-${skip.name}`} className="text-xs text-muted">
                <span className="text-foreground">
                  Row {skip.row}
                  {skip.name ? ` · ${skip.name}` : ""}
                </span>{" "}
                — {skip.reason}
              </li>
            ))}
          </ul>

          {report.skippedTotal > report.skipped.length ? (
            <p className="text-xs text-muted">
              And {report.skippedTotal - report.skipped.length} more.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
