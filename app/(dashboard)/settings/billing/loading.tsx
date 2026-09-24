import { Skeleton } from "@heroui/react";

import { SettingsSection } from "@/components/user-settings/section/settings-section";

/**
 * The plan and the plan columns: the two sections every account has.
 *
 * Payment and Invoices are left out. Only a subscriber has them, they sit below
 * everything else, and a skeleton that drew them for a free account would be
 * two sections that vanish on arrival. Appearing at the bottom of the page moves
 * nothing above them.
 *
 * Sized against the real page at 1536px (September 2026): the plan card's two
 * lines are 28px and 20px, the columns 512px, the note under them one 16px
 * line. The Plans heading's description is a reserved blank line, because its
 * words depend on the plan; the words change on arrival, the height does not.
 */
export default function BillingSettingsLoading() {
  return (
    <>
      <SettingsSection title="Plan">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Skeleton className="h-7 w-32 rounded-lg" />
              <Skeleton className="h-5 w-64 max-w-full rounded-lg" />
            </div>
            <Skeleton className="h-9 w-28 rounded-3xl" />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Plans"
        description={" "}
        action={<Skeleton className="h-10 w-[14.625rem] rounded-full" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((column) => (
            <Skeleton key={column} className="h-[32rem] w-full rounded-3xl" />
          ))}
        </div>
        <Skeleton className="mt-4 h-4 w-3/4 rounded-lg" />
      </SettingsSection>
    </>
  );
}
