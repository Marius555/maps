"use client";

import { Button, Popover, toast } from "@heroui/react";
import { Sheet } from "lucide-react";
import { useState } from "react";

import { useSheetLink, useSyncSheet } from "@/lib/query/sheet-link";
import { toastProblem } from "@/lib/query/toast-error";
import { describeSyncCounts, describeSyncResult } from "@/lib/sheet-sync/describe";
import type { SheetLinkView } from "@/lib/sheet-sync/types";
import { SheetSyncPanel } from "./sheet-sync-panel";

/**
 * The Locations toolbar's way into a map's linked Google Sheet.
 *
 * Draws nothing on a map with no link — which is nearly every map, and the
 * import is where a link is made.
 *
 * **The label never changes.** "Synced 2 hours ago" would be the obvious thing
 * to put on it, and it would grow and shrink with the clock in a toolbar that
 * already wraps when a control changes width (docs/notes/editor-and-layout.md,
 * Surfaces). The time is in the popover. What the button does carry is a dot
 * when the last sync needs the owner — it failed, it is waiting to be told it
 * may remove locations, or it left work behind — positioned so it costs no
 * width, with the same fact in `sr-only` text.
 *
 * The sync runs from here rather than from the panel, so closing the popover
 * mid-sync does not unmount the thing that is looping over its steps; the toast
 * reports the outcome either way.
 */
export function SheetSyncButton({
  mapId,
  initialLink,
}: {
  mapId: string;
  initialLink: SheetLinkView | null;
}) {
  const { data: link } = useSheetLink(mapId, initialLink);
  const [isOpen, setIsOpen] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const sync = useSyncSheet(mapId, {
    onStep: (step) => {
      if (step.more) setProgress(describeSyncCounts(step.report).toLowerCase());
    },
  });

  if (!link) return null;

  const needsAttention =
    !sync.isPending &&
    (link.lastStatus === "failed" ||
      link.lastStatus === "needs_confirmation" ||
      link.lastStatus === "partial");

  const runSync = (options: { confirmRemovals?: boolean } = {}) => {
    setProgress(null);

    sync.mutate(options, {
      onSuccess: ({ status, report }) => {
        // The one outcome that is not news: the panel is showing the question.
        if (status === "needs_confirmation") {
          setIsOpen(true);
          return;
        }

        if (status === "failed") {
          toastProblem("Couldn't sync", report.message ?? null);
          return;
        }

        const description = [describeSyncResult(report), report.message]
          .filter(Boolean)
          .join(" ");

        if (status === "partial") {
          toast.warning("Synced some of the sheet", { description, timeout: 10000 });
        } else {
          toast.success("Synced", { description });
        }
      },
      onError: (error) => toastProblem("Couldn't sync", error),
      onSettled: () => setProgress(null),
    });
  };

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button variant="secondary" className="relative">
        <Sheet aria-hidden="true" className="size-4" />
        Sheet sync
        {needsAttention ? (
          <>
            <span
              aria-hidden="true"
              className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background ${
                link.lastStatus === "partial" ? "bg-warning" : "bg-danger"
              }`}
            />
            <span className="sr-only">, needs attention</span>
          </>
        ) : null}
      </Button>

      <Popover.Content placement="bottom end">
        <Popover.Dialog aria-label="Google Sheet sync">
          <SheetSyncPanel
            mapId={mapId}
            link={link}
            isSyncing={sync.isPending}
            progress={progress}
            onSync={runSync}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
