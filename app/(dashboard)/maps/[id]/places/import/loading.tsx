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
 * The blocks follow the real step top to bottom: the title and its line, the
 * two source cards (stacked below `sm`), the panel cell —
 * which holds both panels stacked, so its height does not depend on the source
 * picked (see `source-choice.tsx`) — and the facts line.
 */
export default function ImportLoading() {
  return (
    <Container size="content" className="flex flex-col">
      <div className="mx-auto my-auto w-full max-w-2xl">
        <div className="space-y-6">
          {/* Title and its line. */}
          <div className="space-y-1">
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-44 rounded-lg" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3 w-72 max-w-full rounded-lg" />
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Skeleton className="h-[62px] rounded-xl" />
                <Skeleton className="h-[62px] rounded-xl" />
              </div>
              <Skeleton className="h-[318px] w-full rounded-xl sm:h-[277px]" />
            </div>

            {/* The two facts: one line from `sm` up, two below it. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-x-6">
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-52 rounded-lg" />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-56 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
