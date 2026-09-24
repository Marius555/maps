import { Skeleton } from "@heroui/react";

import { SettingsSection } from "@/components/user-settings/section/settings-section";

/**
 * The General page with its data left out: the same sections under the same
 * headings, the avatar, the field, the three tiles. Everything that is only
 * text is the real text, so the swap changes what is drawn and not where.
 */
export default function GeneralSettingsLoading() {
  return (
    <>
      <SettingsSection title="Profile">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-3 w-3/5 rounded-lg" />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-0.5 sm:ps-16">
              <Skeleton className="h-5 w-12 rounded-lg" />
              <Skeleton className="h-5 w-48 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-32 self-end rounded-3xl" />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Appearance"
        description="How the dashboard looks in this browser. Your published maps keep their own look."
      >
        <div className="grid grid-cols-3 gap-3 sm:max-w-lg sm:gap-4">
          {[0, 1, 2].map((tile) => (
            <div key={tile} className="space-y-2.5">
              {/* The tile's own frame, border and padding included, so the
                  preview inside it is the real preview's height. */}
              <div className="rounded-xl border-2 border-transparent p-0.5">
                <Skeleton className="aspect-[16/10] w-full rounded-[0.55rem]" />
              </div>
              <Skeleton className="h-5 w-3/4 rounded-lg" />
            </div>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}
