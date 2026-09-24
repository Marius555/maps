import type { Metadata } from "next";

import { AppearancePicker } from "@/components/user-settings/general/appearance-picker";
import { ProfileForm } from "@/components/user-settings/general/profile-form";
import { SettingsSection } from "@/components/user-settings/section/settings-section";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "General settings" };

/**
 * Who you are and how the dashboard looks. `requireUser` is the dashboard
 * layout's own cached read, so this page costs no request of its own.
 */
export default async function GeneralSettingsPage() {
  const user = await requireUser();

  return (
    <>
      <SettingsSection title="Profile">
        <ProfileForm name={user.name} email={user.email} />
      </SettingsSection>

      <SettingsSection
        title="Appearance"
        description="How the dashboard looks in this browser. Your published maps keep their own look."
      >
        <AppearancePicker />
      </SettingsSection>
    </>
  );
}
