"use client";

import { Button, Switch, toast } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

import { useSetSheetAutoSync, useUnlinkSheet } from "@/lib/query/sheet-link";
import { toastProblem } from "@/lib/query/toast-error";
import { sheetUrl, type SheetLinkView } from "@/lib/sheet-sync/types";
import { SyncReport } from "./sync-report";

/**
 * Everything about a map's linked sheet, in the popover the toolbar opens.
 *
 * Sync now is the primary action and comes first; the daily switch and Unlink
 * are settings you change once, so they sit under the report. The sync itself is
 * owned by the button that opened this (`SheetSyncButton`), because it has to
 * keep running and report back if the popover is closed half way through.
 */
export function SheetSyncPanel({
  mapId,
  link,
  isSyncing,
  progress,
  onSync,
}: {
  mapId: string;
  link: SheetLinkView;
  isSyncing: boolean;
  /** Locations changed so far in a sync that is still running, or null. */
  progress: string | null;
  onSync: (options?: { confirmRemovals?: boolean }) => void;
}) {
  const setAutoSync = useSetSheetAutoSync(mapId);
  const unlink = useUnlinkSheet(mapId);

  return (
    <div className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Google Sheet</p>
        <p className="text-xs text-muted">
          {isSyncing
            ? `Syncing…${progress ? ` ${progress} so far.` : ""}`
            : link.lastSyncedAt
              ? `Synced ${formatDistanceToNow(new Date(link.lastSyncedAt), {
                  addSuffix: true,
                })}.`
              : "Not synced yet."}{" "}
          Rows in the sheet are the locations on this map.
        </p>
        <a
          href={sheetUrl(link)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline focus-visible:underline"
        >
          Open the sheet
          <ExternalLink aria-hidden="true" className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>

      <Button
        className="w-full"
        isPending={isSyncing}
        onPress={() => onSync()}
      >
        {isSyncing ? "Syncing" : "Sync now"}
      </Button>

      <SyncReport
        status={isSyncing ? null : link.lastStatus}
        report={isSyncing ? null : link.lastReport}
        isSyncing={isSyncing}
        onConfirmRemovals={() => onSync({ confirmRemovals: true })}
      />

      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <Switch
          isSelected={link.autoSync}
          isDisabled={setAutoSync.isPending}
          onChange={(autoSync) =>
            setAutoSync.mutate(autoSync, {
              onError: (error) => toastProblem("Couldn't change daily sync", error),
            })
          }
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-sm">Sync every day</span>
          </Switch.Content>
        </Switch>

        <Button
          size="sm"
          variant="tertiary"
          className="self-start"
          isPending={unlink.isPending}
          isDisabled={isSyncing}
          onPress={() =>
            unlink.mutate(undefined, {
              onSuccess: () =>
                toast.success("Unlinked", {
                  description:
                    "Your locations stay as they are. Edits to the sheet no longer reach this map.",
                }),
              onError: (error) => toastProblem("Couldn't unlink the sheet", error),
            })
          }
        >
          Unlink sheet
        </Button>
      </div>
    </div>
  );
}
