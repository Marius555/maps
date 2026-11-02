import { redirect } from "next/navigation";

import { settingsHomeFor } from "@/components/user-settings/shell/settings-items";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * `/settings` is the first section, under its own name so the nav can say so —
 * General, or Billing for a shop inside the Shopify admin, which has no General
 * (`settingsItemsFor`). The admin's own "Settings" link lands here.
 */
export default async function SettingsIndex() {
  const user = await getCurrentUser();

  redirect(settingsHomeFor(Boolean(user?.shopify)));
}
