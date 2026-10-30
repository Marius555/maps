/**
 * The cookie naming the workspace the dashboard is looking at.
 *
 * **A hint, never a grant.** It is checked against the memberships table on
 * every request it is read for (lib/team/resolve.ts), and a value naming a
 * workspace the person is not in falls back to their own — the treatment
 * `sidebarMapId` gives the last-map cookie. So a forged or stale value costs a
 * wrong landing page, never access.
 *
 * A plain module, not part of a `"use client"` file, for the reason
 * `components/layout/sidebar/sidebar-cookies.ts` gives: a server component
 * reading an export of a client module gets a reference, not the string.
 */
export const ACTIVE_WORKSPACE_COOKIE = "pg_workspace";

/** A year; it is a preference, and a stale one is harmless. */
export const ACTIVE_WORKSPACE_MAX_AGE = 60 * 60 * 24 * 365;
