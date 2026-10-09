import { existsSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";
import { deleteMap, listMaps } from "./api";
import { AUTH_FILE, E2E_PREFIX, SECOND_AUTH_FILE } from "./paths";

/**
 * Deletes every `e2e-` map still on either test account. Each test cleans up
 * after itself; this catches the ones a crash or a Ctrl+C left behind, which
 * would otherwise pile up until a plan limit started failing unrelated tests —
 * on the second account, which plan-limits.spec.ts walks up to its ceiling,
 * after a single map.
 *
 * Notifications and news posts made by the admin specs are deleted in their
 * own `finally`; the console has no list route to sweep them from here.
 */
export default async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  for (const file of [AUTH_FILE, SECOND_AUTH_FILE]) {
    if (existsSync(file)) await sweep(baseURL, file);
  }
}

async function sweep(baseURL: string | undefined, storageState: string) {
  const context = await request.newContext({ baseURL, storageState });

  try {
    // Signed out (an expired session, or a run that never logged in): nothing
    // can be swept, and that is not worth a stack trace.
    const probe = await context.get("/api/maps");
    if (probe.status() === 401) return;

    const maps = await listMaps(context);
    for (const map of maps) {
      if (map.name.startsWith(E2E_PREFIX)) await deleteMap(context, map.id);
    }
  } catch (error) {
    // A sweep that fails must not turn a green run red; say so and move on.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[e2e teardown] could not sweep leftover maps (${storageState}): ${message}`);
  } finally {
    await context.dispose();
  }
}
