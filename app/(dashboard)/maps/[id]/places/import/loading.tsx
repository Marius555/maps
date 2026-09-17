import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";

/**
 * Shown while the import wizard loads, and it always lands on the Source step.
 *
 * So this draws the Source step specifically, at the Source step's width: the
 * page is `size="content"` and the wizard caps itself per step (see `isWide` in
 * import-wizard.tsx), so a skeleton that filled the content width would widen the
 * page and then narrow it the moment the real thing arrived.
 *
 * The vertical centring is repeated here for the same reason the width is —
 * `flex flex-col` on the `Container` and `my-auto` on the column, matching
 * `page.tsx`, or the skeleton sits at the top and the real thing drops into the
 * middle of the screen as it arrives.
 *
 * No panel around the body: the real step lost its `SectionPanel`, and a
 * skeleton still drawing one arrived as a bordered box that vanished on swap.
 * The heights are the real step's, measured: a 16px trail, 24px, a 40px tab
 * strip, 16px, the tab cell, 16px, a 16px plan line. The cell holds both tab
 * panels stacked (see `source-tabs.tsx`), so its height does not depend on the
 * tab — 198px from `sm` up and 216px below it, where the sheet note wraps.
 */
export default function ImportLoading() {
  return (
    <Container size="content" className="flex flex-col">
      <div className="mx-auto my-auto w-full max-w-2xl">
        <div className="space-y-6">
          {/* Source → Columns → Addresses → Review, as four words and three
              arrows rather than one solid bar. */}
          <div className="flex h-4 items-center gap-x-2">
            <Skeleton className="h-3 w-12 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-lg" />
            <Skeleton className="h-3 w-12 rounded-lg" />
          </div>

          <div className="space-y-4">
            {/* The tab strip and the cell under it. */}
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-3xl" />
              <Skeleton className="h-54 w-full rounded-xl sm:h-[12.375rem]" />
            </div>

            {/* The plan-headroom line. */}
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-2/5 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
