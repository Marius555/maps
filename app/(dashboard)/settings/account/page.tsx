import type { Metadata } from "next";

import { DeleteAccountButton } from "@/components/user-settings/account/delete-account/delete-account-button";
import { PasswordForm } from "@/components/user-settings/account/password-form";
import { SessionList } from "@/components/user-settings/account/session-list";
import { SignOutOthersButton } from "@/components/user-settings/account/sign-out-others-button";
import { SettingsRow, SettingsRows } from "@/components/user-settings/section/settings-row";
import {
  DELETE_ACCOUNT_ROW,
  DEVICES_SECTION,
  PASSWORD_SECTION,
} from "@/components/user-settings/account/copy";
import { SettingsSection } from "@/components/user-settings/section/settings-section";
import { accountHasPassword } from "@/lib/auth/account";
import { requireUser } from "@/lib/auth/current-user";
import { listAccountSessions } from "@/lib/auth/sessions";
import { repoContext } from "@/lib/repositories/context";
import { countMaps } from "@/lib/repositories/maps.repository";

export const metadata: Metadata = { title: "Account settings" };

/**
 * Signing in, and leaving: the password, the devices signed in, and deleting
 * the account.
 *
 * Everything is read before the page renders — whether there is a password,
 * the device list, the map count the deletion dialog names — so each section
 * arrives at its final height and nothing lands later to push the next one
 * down. The three reads are independent and run together.
 */
export default async function AccountSettingsPage() {
  const user = await requireUser();

  const [hasPassword, sessions, mapCount] = await Promise.all([
    accountHasPassword(user.id),
    listAccountSessions(),
    countMaps(repoContext(user.id)),
  ]);

  const others = sessions.filter((session) => !session.current).length;

  return (
    <>
      {/* Only for an account that signs in with a password. One made by Google
          sign-in has none to change, and the route refuses it one. */}
      {hasPassword ? (
        <SettingsSection {...PASSWORD_SECTION}>
          <PasswordForm email={user.email} />
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={DEVICES_SECTION.title}
        description={DEVICES_SECTION.description}
        action={<SignOutOthersButton isDisabled={others === 0} />}
      >
        <SessionList sessions={sessions} />
      </SettingsSection>

      <SettingsSection title="Delete account">
        <SettingsRows>
          <SettingsRow {...DELETE_ACCOUNT_ROW}>
            <DeleteAccountButton email={user.email} mapCount={mapCount} />
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>
    </>
  );
}
