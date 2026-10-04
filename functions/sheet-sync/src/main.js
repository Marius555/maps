/**
 * The automatic Google Sheets sync — the `googleSheetsUpdate` Appwrite Function,
 * scheduled every 30 minutes.
 *
 * It holds no sync logic. That lives in the dashboard (lib/sheet-sync/run.ts),
 * behind `/api/cron/sheet-sync`, and this only drives it: ask which maps are
 * due, then call one bounded step at a time for each until the map answers
 * `more: false`. `npm run setup:sheet-sync` deploys it and sets everything
 * below; docs/notes/sheet-sync.md has the rest.
 *
 * **Why a function and not the site.** Appwrite Sites has no cron, and it cuts
 * off any request after its site timeout (30 seconds at most). A function may
 * run for fifteen minutes when it is executed asynchronously, which a scheduled
 * execution is. Each step it calls still finishes well inside the site's own
 * limit, because the site is what actually does the work.
 *
 * **It also runs the visitor-session purge, once a day.** The runs that start in
 * the 03:00 UTC hour first walk `/api/cron/session-retention` (lib/analytics/
 * retention.ts) for at most `RETENTION_BUDGET_MS`: the Privacy Policy promises
 * raw sessions are deleted after the plan's retention period, and this is the
 * only scheduler the project has. Both half-hour runs in that hour do it, which
 * is harmless — the second finds nothing left.
 *
 * No dependencies: Node's own `fetch` is enough, and a function with no
 * `node_modules` deploys in seconds and has nothing to patch.
 *
 * Environment variables (function settings):
 *   APP_URL      The dashboard's origin, e.g. https://app.example.com
 *   CRON_SECRET  The same value the site has
 */

/** Stop starting steps with this much of the 900-second ceiling left. */
const RESERVE_MS = 60_000;
/**
 * The function's own timeout, as configured. Keep the two in step. It is under
 * the 30-minute schedule, so one run is always over before the next starts.
 */
const FUNCTION_TIMEOUT_MS = 900_000;
/** A runaway guard for one map, far past any real sheet. */
const MAX_STEPS_PER_MAP = 400;
/** The UTC hour whose runs purge expired visitor sessions first. */
const RETENTION_HOUR_UTC = 3;
/** The most of one run the purge may take before the sync gets the rest. */
const RETENTION_BUDGET_MS = 120_000;

const syncDueMaps = async ({ res, log, error }) => {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  const secret = process.env.CRON_SECRET ?? "";

  if (!appUrl || !secret) {
    error("APP_URL and CRON_SECRET must both be set on this function.");
    return res.json({ ok: false }, 500);
  }

  const deadline = Date.now() + FUNCTION_TIMEOUT_MS - RESERVE_MS;

  const call = async (method, body, path = "/api/cron/sheet-sync") => {
    const response = await fetch(`${appUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `${method} ${path} answered ${response.status}: ${
          payload?.error?.message ?? "no message"
        }`,
      );
    }

    return payload.data;
  };

  if (new Date().getUTCHours() === RETENTION_HOUR_UTC) {
    await purgeExpiredSessions(call, Date.now() + RETENTION_BUDGET_MS, { log, error });
  }

  const { mapIds } = await call("GET");
  const summary = [];

  for (const mapId of mapIds) {
    if (Date.now() > deadline) {
      log(`Out of time; ${mapIds.length - summary.length} maps wait for the next run.`);
      break;
    }

    let steps = 0;
    let status = "not started";

    try {
      let continuing = false;

      while (steps < MAX_STEPS_PER_MAP && Date.now() < deadline) {
        const result = await call("POST", { mapId, continuing });
        steps += 1;
        status = result.status;

        if (!result.more) break;
        continuing = true;
      }
    } catch (cause) {
      // One map failing must not stop every map after it.
      error(`Map ${mapId}: ${cause instanceof Error ? cause.message : String(cause)}`);
      status = "error";
    }

    summary.push({ mapId, status, steps });
  }

  log(`Synced ${summary.length} of ${mapIds.length} due maps.`);

  return res.json({ ok: true, summary });
};

/**
 * Walk every map once, step by step, deleting raw sessions past retention.
 * A failure is logged and dropped: tomorrow's run starts again from the top.
 */
async function purgeExpiredSessions(call, deadline, { log, error }) {
  let cursor = null;
  let purgedDays = 0;

  try {
    do {
      const step = await call("POST", { cursor }, "/api/cron/session-retention");
      purgedDays += step.purgedDays;
      cursor = step.cursor;
    } while (cursor && Date.now() < deadline);
  } catch (cause) {
    error(`Session retention: ${cause instanceof Error ? cause.message : String(cause)}`);
  }

  log(`Session retention: ${purgedDays} map-days purged${cursor ? ", stopped at the budget; the next purge starts over" : ""}.`);
}

export default syncDueMaps;
