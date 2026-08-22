"use client";

import { Button, Popover } from "@heroui/react";
import { Download } from "lucide-react";
import { useState } from "react";

import { ExportPanel } from "@/components/export/export-panel";
import type { ExportOptions } from "@/lib/export/export-map";

/**
 * Take a picture of the map.
 *
 * On the right of the toolbar's rule, next to Preview: the rule separates tools
 * that change what a gesture *means* — add, draw, select — from things you do
 * *to* the map, and this is squarely the second. Icon-only for the same reason
 * its neighbours are, which is that the row already competes with the search
 * field on a phone.
 *
 * A plain Button rather than the repo's IconButton, and for the reason
 * `appearance-button.tsx` spells out: IconButton wraps its trigger in a Tooltip,
 * and a tooltip on a popover trigger stays up over the panel it just opened.
 *
 * The panel keeps its choices while the popover is closed and reopened — a
 * format and a page size are a preference for the session, and re-picking A4
 * every time is the sort of thing that makes a control feel like paperwork.
 */
export function ExportButton({
  options,
  view,
  isBusy,
  error,
  onChange,
  onExport,
  onOpen,
}: {
  options: ExportOptions;
  view: { width: number; height: number };
  isBusy: boolean;
  error: string | null;
  onChange: (options: ExportOptions) => void;
  onExport: () => void;
  /** Clears a stale failure, so the panel does not open onto an old complaint. */
  onOpen: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) onOpen();
        setIsOpen(open);
      }}
    >
      <Button size="sm" variant="tertiary" isIconOnly aria-label="Export this map">
        <Download aria-hidden="true" className="size-4" />
      </Button>

      <Popover.Content placement="bottom end">
        <Popover.Dialog aria-label="Export this map">
          <div className="max-h-[70dvh] overflow-y-auto overscroll-contain p-0.5">
            <ExportPanel
              value={options}
              view={view}
              isBusy={isBusy}
              error={error}
              onChange={onChange}
              onExport={onExport}
            />
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
