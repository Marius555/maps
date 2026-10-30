import "server-only";

import { cookies } from "next/headers";

import { ACTIVE_WORKSPACE_COOKIE, ACTIVE_WORKSPACE_MAX_AGE } from "./active-cookie";

/**
 * Writing the active-workspace hint. Only after the server has checked the
 * person belongs there — though a stale or forged value is harmless anyway,
 * because every read checks it again (lib/team/resolve.ts).
 *
 * `lax` rather than the session's `strict`: this cookie grants nothing, and a
 * team member arriving from a link in an email should land in the team they
 * were last looking at rather than bounce to their own maps.
 */
export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const jar = await cookies();

  jar.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_WORKSPACE_MAX_AGE,
  });
}

/** Back to the person's own workspace — after leaving a team, for one. */
export async function clearActiveWorkspace(): Promise<void> {
  const jar = await cookies();

  jar.delete(ACTIVE_WORKSPACE_COOKIE);
}

export async function readActiveWorkspace(): Promise<string | null> {
  const jar = await cookies();

  return jar.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
}
