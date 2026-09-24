import { Skeleton } from "@heroui/react";

import {
  DELETE_ACCOUNT_ROW,
  DEVICES_SECTION,
  PASSWORD_SECTION,
} from "@/components/user-settings/account/copy";
import { SettingsRow, SettingsRows } from "@/components/user-settings/section/settings-row";
import { SettingsSection } from "@/components/user-settings/section/settings-section";
import {
  FieldSkeleton,
  RowSkeleton,
} from "@/components/user-settings/section/settings-skeletons";

/**
 * The Account page without its reads. Every word that does not depend on the
 * account is the real word, from the same module the page reads it from, so it
 * wraps the same. The password section is drawn the way most accounts get it; a
 * Google-only account has none, so for them the page arrives shorter.
 */
export default function AccountSettingsLoading() {
  return (
    <>
      <SettingsSection {...PASSWORD_SECTION}>
        <div className="space-y-4 sm:max-w-md">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <div className="flex justify-end">
            <Skeleton className="h-9 w-40 rounded-3xl" />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        {...DEVICES_SECTION}
        action={<Skeleton className="h-8 w-44 rounded-3xl" />}
      >
        <div className="divide-y divide-separator">
          <div className="pb-3">
            <RowSkeleton />
          </div>
          <div className="pt-1">
            <div className="flex h-10 items-center">
              <Skeleton className="h-4 w-40 rounded-lg" />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Delete account">
        <SettingsRows>
          <SettingsRow {...DELETE_ACCOUNT_ROW}>
            <Skeleton className="h-10 w-36 rounded-3xl" />
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>
    </>
  );
}
