/**
 * The sidebar's two cookies, named once for the server that reads them and the
 * client that writes them.
 *
 * **A module of its own, and that is not tidiness** — the same reason
 * `components/marketing/min-share.ts` exists. These used to be exported from
 * `sidebar-context.tsx`, which is `"use client"`, and every export of a client
 * module read from a *server* component is a client reference rather than the
 * value. So the dashboard layout called `cookies().get(<reference>)`, got
 * nothing back, and rendered every page with the sidebar expanded whatever the
 * cookie said — a collapsed sidebar never survived a reload, and nothing warned.
 * A plain module both halves import is the fix.
 */

/** Whether the desktop sidebar is collapsed to its icon rail. */
export const SIDEBAR_COOKIE = "sidebar_collapsed";

/**
 * The map whose section the sidebar keeps showing after you step out of it.
 *
 * Without it the per-map group existed only under `/maps/<id>`, so opening
 * Account from the user menu emptied the sidebar down to two rows and it came
 * back only when you went back into a map. A cookie rather than local state for
 * the reason `SIDEBAR_COOKIE` is one: the layout reads it on the server, so a
 * hard load of `/account` paints the group on the first frame instead of popping
 * it in after hydration.
 */
export const SIDEBAR_MAP_COOKIE = "sidebar_map";
