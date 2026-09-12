import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";
import { SectionPanelSkeleton } from "@/components/ui/skeletons";

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
 * It used to be one 156px box standing in for a 460px panel, which meant the
 * swap dropped everything below it by 300px. The body below mirrors the real
 * one: the two-up tab strip and the dashed dropzone, both at the `max-w-2xl`
 * that `source-tabs.tsx` puts on them.
 */
export default function ImportLoading() {
  return (
    <Container size="content" className="flex flex-col">
      <div className="mx-auto my-auto w-full max-w-5xl">
        <div className="space-y-6">
          {/* Source → Columns → Addresses → Review, as four words and three
              arrows rather than one solid bar. */}
          <div className="flex items-center gap-x-2">
            <Skeleton className="h-3 w-12 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-lg" />
            <Skeleton className="h-3 w-12 rounded-lg" />
          </div>

          <SectionPanelSkeleton>
            {/* The segmented control. */}
            <Skeleton className="mx-auto h-10 w-full max-w-2xl rounded-3xl" />

            {/* The dashed frame: `px-6 py-10` around an icon puck, a button, and
                two lines of note — 245px in the real thing. */}
            <Skeleton className="mx-auto h-[15.5rem] w-full max-w-2xl rounded-xl" />

            {/* The plan-headroom line. */}
            <Skeleton className="h-3 w-2/5 rounded-lg" />
          </SectionPanelSkeleton>
        </div>
      </div>
    </Container>
  );
}
