/**
 * The Account page's fixed words, shared by the page and its `loading.tsx` so
 * the two wrap to the same number of lines and the skeleton is the page's own
 * height. A plain module, not a component file, so a server component reads the
 * strings rather than a client reference (CLAUDE.md, "Stack specifics").
 */
export const DELETE_ACCOUNT_ROW = {
  label: "Delete this account",
  description:
    "Deletes your maps, locations, photos and analytics, and cancels any subscription. Embedded maps stop working.",
} as const;

export const PASSWORD_SECTION = {
  title: "Password",
  description: "Changing it signs out every other device.",
} as const;

export const DEVICES_SECTION = {
  title: "Signed-in devices",
  description:
    "Everywhere this account is signed in. Sign out anything you don't recognise, then change your password.",
} as const;
