/**
 * The settings sections, in the order the nav lists them.
 *
 * A plain module rather than a constant inside the nav, because the layout's
 * skeletons and the nav both need it, and a `"use client"` file hands a server
 * component a client reference rather than the array (CLAUDE.md, "Stack
 * specifics").
 */
export const SETTINGS_ITEMS = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/usage", label: "Usage" },
] as const;

export type SettingsItem = (typeof SETTINGS_ITEMS)[number];
