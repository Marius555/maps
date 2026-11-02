/**
 * The settings sections, in the order the nav lists them.
 *
 * A plain module rather than a constant inside the nav, because the layout's
 * skeletons and the nav both need it, and a `"use client"` file hands a server
 * component a client reference rather than the array (CLAUDE.md, "Stack
 * specifics").
 *
 * `shopify: false` is a section a shop inside the Shopify admin does not get
 * (docs/notes/shopify.md, "Accounts"), leaving it Billing and Usage:
 * **General** is the name and address you sign in with, and the light/dark
 * theme — a shop signs in with neither, its name is Shopify's, and the app is
 * always light there; **Account** is a password, signed-in devices and
 * deleting the account — a shop has no password or session of ours, and its
 * data goes when the app is uninstalled; **Team** is not offered inside
 * Shopify. General redirects a shop to Billing, and the other two 404, so a
 * typed URL cannot reach them.
 */
export const SETTINGS_ITEMS = [
  { href: "/settings/general", label: "General", shopify: false },
  { href: "/settings/account", label: "Account", shopify: false },
  { href: "/settings/team", label: "Team", shopify: false },
  { href: "/settings/billing", label: "Billing", shopify: true },
  { href: "/settings/usage", label: "Usage", shopify: true },
] as const;

export type SettingsItem = (typeof SETTINGS_ITEMS)[number];

/** The sections this person sees: all of them, or a shop's. */
export function settingsItemsFor(isShopify: boolean): readonly SettingsItem[] {
  return isShopify ? SETTINGS_ITEMS.filter((item) => item.shopify) : SETTINGS_ITEMS;
}

/** Where `/settings` opens: General, or for a shop the first section it has. */
export function settingsHomeFor(isShopify: boolean): string {
  return settingsItemsFor(isShopify)[0].href;
}
