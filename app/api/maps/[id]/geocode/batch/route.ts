import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { getGeocoder, statusFor } from "@/lib/geocoding";
import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import { getMap } from "@/lib/repositories/maps.repository";
import { assertPlaceHeadroom } from "@/lib/repositories/places.repository";
import {
  assertLookupHeadroom,
  lookupMeter,
} from "@/lib/repositories/usage.repository";
import { IN_FLIGHT_LIMITS } from "@/lib/limits/rate";
import { inFlight } from "@/lib/rate-limit/limiter";
import { geocodeBatchSchema } from "@/lib/validation/geocode.schema";

type Params = { id: string };

/*
 * A chunk of 25 rows spends around six seconds inside the provider's own pacing.
 * There used to be a `maxDuration = 60` here; it is a Vercel setting and does
 * nothing on Appwrite Sites, which cuts every request at 30 seconds (CLAUDE.md
 * §12). What protects the bill from a chunk killed mid-flight is `lookupMeter`,
 * which records as it goes.
 */

/**
 * Geocodes a chunk of an import.
 *
 * Nothing is written here — results go back to the client for the review step,
 * and only a confirmed review creates places. That is CLAUDE.md §7's "never save
 * geocode results silently", enforced by the endpoint having no write path at all.
 *
 * One row failing must not fail the chunk: a single unresolvable address in a
 * 500-row CSV would otherwise block the whole import.
 *
 * **The plan check happens before the geocoder runs, not after.** This endpoint
 * spends requests against a rate-limited, metered upstream, and until this guard
 * existed the only ceiling was at insert time in `createPlaces` — so a free-plan
 * map with ten slots could walk a 500-row file through the geocoder and be
 * refused at the end, having spent all 500. §6 is explicit that a limit lives in
 * the repository and not only in the UI; the wizard's own headroom banner is the
 * courtesy, this is the rule.
 *
 * **It is checked against the run, not the chunk**, and that is the difference
 * between a guard and a formality. `existing + 25 > limit` is false for almost
 * every chunk of almost every file — a map with ten free slots has room for any
 * twenty-five rows — so the old form let the entire file through and refused at
 * the end anyway. `runTotal` is what the client says the whole import will
 * create, so the *first* chunk is the one that gets refused.
 *
 * **What used to be left open, and now is not.** Geocoding writes nothing, so the
 * server could not see how far an import had already got, and `runTotal` is a
 * number the *client* chose — so a scripted caller could understate it, or re-send
 * chunk after chunk that each fit the headroom on their own, and spend without
 * limit. `assertLookupHeadroom` closes that: the count is kept per account in the
 * `usage` table, so it survives the request that caused it and no number the
 * client sends can talk it down. `runTotal` still earns its place — it is what
 * makes the *first* chunk the one refused when a file plainly will not fit — but
 * it is no longer the only thing standing between a stranger and our bill.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, geocodeBatchSchema);

  await assertPlaceHeadroom(
    ctx,
    params.id,
    Math.max(input.runTotal ?? 0, input.rows.length),
  );

  /*
   * Only rows with an address reach the geocoder, so only those are asserted for.
   * Counting the blank ones would refuse an import for lookups it was never going
   * to make — and a file with an unmapped address column is mostly blank rows.
   *
   * `interactive`, not `background`: an import is somebody sitting in the wizard
   * watching a progress bar, even though it is long. The thing that stands aside
   * for it is the routability sweep.
   */
  const billable = input.rows.filter((row) => Boolean(row.address)).length;

  await assertLookupHeadroom(ctx.userId, billable, "interactive");

  /*
   * One batch at a time per account. The headroom check above runs before any
   * of this batch is recorded, so two batches side by side could each pass it
   * with room for only one; the import wizard sends them one after another
   * anyway, and a 429 here is what its retry already waits out.
   */
  const release = inFlight(`geocodeBatch:${ctx.userId}`, IN_FLIGHT_LIMITS.geocodeBatch);
  const meter = lookupMeter(ctx.userId);
  const geocoder = getGeocoder();

  try {
    const results: BatchGeocodeResult[] = [];

    // Sequential by design. The provider throttle serialises these anyway, and
    // Promise.all would only queue them all up front with no ordering benefit.
    for (const row of input.rows) {
      if (!row.address) {
        results.push({
          key: row.key,
          candidate: null,
          alternatives: [],
          status: "failed",
        });
        continue;
      }

      const candidates = await geocoder.search({
        address: row.address,
        countryCode: input.countryCode,
        limit: 5,
      });
      await meter.spent();

      const [best = null, ...alternatives] = candidates;

      results.push({
        key: row.key,
        candidate: best,
        alternatives,
        status: statusFor(best),
      });
    }

    /*
     * The pacing goes back with the results so the wizard can say how long the
     * rest of the file will take.
     *
     * A number of milliseconds and never the provider's name: which service
     * answered stays inside /lib/geocoding (§7), and what leaves the boundary is
     * the one fact the caller actually needs. It is reported per chunk rather
     * than fetched once, because it costs nothing here and it means the estimate
     * corrects itself if the pace is changed under a running import.
     */
    return ok({ results, paceMs: geocoder.paceMs });
  } catch (error) {
    return geocoderFailure(error);
  } finally {
    await meter.flush();
    release();
  }
}, { rateLimit: "metered" });
