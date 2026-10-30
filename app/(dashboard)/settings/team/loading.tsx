import { Skeleton } from "@heroui/react";

import { MEMBERS_SECTION } from "@/components/user-settings/team/copy";
import { SettingsSection } from "@/components/user-settings/section/settings-section";
import { RowsSkeleton } from "@/components/user-settings/section/settings-skeletons";

/**
 * The Team page without its reads: the section most people have — the team
 * itself, with its owner and one more row — under its real description, so the
 * text wraps where the page's will.
 */
export default function TeamSettingsLoading() {
  return (
    <SettingsSection
      title="Your team"
      description={MEMBERS_SECTION.description}
      action={<Skeleton className="h-8 w-32 rounded-3xl" />}
    >
      <div className="space-y-4">
        <Skeleton className="h-5 w-56 rounded-lg" />
        <RowsSkeleton rows={2} />
      </div>
    </SettingsSection>
  );
}
