/**
 * The daily Google Sheets sync — an Appwrite Function on a schedule.
 *
 * It holds no sync logic. That lives in the dashboard (lib/sheet-sync/run.ts),
 * behind `/api/cron/sheet-sync`, and this only drives it: ask which maps are
 * due, then call one bounded step at a time for each until the map answers
 * `more: false`. docs/notes/sheet-sync.md has the setup.
 *
 * **Why a function and not the site.** Appwrite Sites has no cron, and it cuts
 * off any request after its site timeout (30 seconds at most). A function may
 * run for fifteen minutes when it is executed asynchronously, which a scheduled
 * execution is. Each step it calls still finishes well inside the site's own
 * limit, because the site is what actually does the work.
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
/** The function's own timeout, as configured. Keep the two in step. */
const FUNCTION_TIMEOUT_MS = 900_000;
/** A runaway guard for one map, far past any real sheet. */
const MAX_STEPS_PER_MAP = 400;

const syncDueMaps = async ({ res, log, error }) => {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  const secret = process.env.CRON_SECRET ?? "";

  if (!appUrl || !secret) {
    error("APP_URL and CRON_SECRET must both be set on this function.");
    return res.json({ ok: false }, 500);
  }

  const deadline = Date.now() + FUNCTION_TIMEOUT_MS - RESERVE_MS;

  const call = async (method, body) => {
    const response = await fetch(`${appUrl}/api/cron/sheet-sync`, {
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
        `${method} /api/cron/sheet-sync answered ${response.status}: ${
          payload?.error?.message ?? "no message"
        }`,
      );
    }

    return payload.data;
  };

  const { mapIds } = await call("GET");
  const summary = [];

  for (const mapId of mapIds) {
    if (Date.now() > deadline) {
      log(`Out of time; ${mapIds.length - summary.length} maps wait until tomorrow.`);
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

export default syncDueMaps;
