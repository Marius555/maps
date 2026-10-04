import { refuseUnlessCron } from "@/lib/api/cron-auth";
import { ok } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { purgeExpiredSessions } from "@/lib/analytics/retention";
import { sessionRetentionStepSchema } from "@/lib/validation/session-retention.schema";

/**
 * How long one step may spend deleting. Well inside the site's 15-second
 * default timeout (§12), which also has to cover the request around it.
 */
const STEP_MS = 8_000;

/**
 * One step of the visitor-session purge (lib/analytics/retention.ts).
 *
 * Called by the scheduled function (functions/sheet-sync) once a day, from
 * `cursor: null` until it answers `cursor: null` again. Idempotent: a step
 * repeated or interrupted only finds less to delete.
 */
export const POST = withoutAuth(async (request) => {
  const denied = refuseUnlessCron(request);
  if (denied) return denied;

  const input = await parseBody(request, sessionRetentionStepSchema);

  return ok(
    await purgeExpiredSessions({
      cursor: input.cursor,
      deadline: Date.now() + STEP_MS,
      now: new Date(),
    }),
  );
});
