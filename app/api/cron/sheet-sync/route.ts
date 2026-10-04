import { refuseUnlessCron } from "@/lib/api/cron-auth";
import { ok } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import {
  findSheetLinkForMap,
  listDueSheetLinks,
} from "@/lib/repositories/sheet-links.repository";
import { runSheetSyncStep } from "@/lib/sheet-sync/run";
import { cronSyncStepSchema } from "@/lib/validation/sheet-link.schema";

/** How many linked maps one run is offered. The rest go first next run. */
const MAX_LINKS_PER_RUN = 200;

/**
 * A map synced this recently is not due. Runs are 30 minutes apart, so this
 * only ever skips a map its owner synced by hand moments ago — never one the
 * previous run reached, which may have been as late as fourteen minutes into
 * that run (the function stops starting steps at fourteen).
 */
const MIN_GAP_MS = 10 * 60_000;

/**
 * The automatic sync's two calls. docs/notes/sheet-sync.md.
 *
 * The schedule — every 30 minutes — lives in an Appwrite Function
 * (functions/sheet-sync), not here: Appwrite Sites has no cron, and no Sites
 * request may run past 30 seconds. The function may run for fifteen minutes, so it asks this route
 * which maps are due, then walks each one step by step — the same bounded step
 * Sync now uses — until the map says there is no more.
 *
 * **Both refuse when `CRON_SECRET` is unset**, rather than answering anyone who
 * finds the URL: an open trigger would let a stranger spend our geocoding credit
 * and republish every linked map on demand.
 */

/** Maps due an automatic sync, least recently synced first. */
export const GET = withoutAuth(async (request) => {
  const denied = refuseUnlessCron(request);
  if (denied) return denied;

  const links = await listDueSheetLinks(
    MAX_LINKS_PER_RUN,
    new Date(Date.now() - MIN_GAP_MS),
  );

  return ok({ mapIds: links.map((link) => link.mapId) });
});

/**
 * One step of one map's automatic sync.
 *
 * Never confirms removals. A sheet that lost most of its rows overnight stops at
 * `needs_confirmation` and waits for its owner, which is the point of asking.
 */
export const POST = withoutAuth(async (request) => {
  const denied = refuseUnlessCron(request);
  if (denied) return denied;

  const input = await parseBody(request, cronSyncStepSchema);
  const link = await findSheetLinkForMap(input.mapId);

  // Unlinked or switched off since the list was taken: nothing to do, not an error.
  if (!link || !link.autoSync) return ok({ status: "skipped", more: false });

  const outcome = await runSheetSyncStep(link, { continuing: input.continuing });

  return ok({
    status: outcome.status,
    more: outcome.status === "busy" ? false : outcome.more,
  });
});
