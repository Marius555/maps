import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { getGeocoder, statusFor } from "@/lib/geocoding";
import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import { getMap } from "@/lib/repositories/maps.repository";
import { assertPlaceHeadroom } from "@/lib/repositories/places.repository";
import { geocodeBatchSchema } from "@/lib/validation/geocode.schema";

type Params = { id: string };

/**
 * A chunk of 25 rows spends around six seconds inside the provider's own pacing,
 * and the platform's default cap is shorter than that on some plans. Declared
 * rather than left to the default, because the failure it prevents is a chunk
 * that is killed mid-flight after the upstream requests have already been paid
 * for — see `MAX_GEOCODE_BATCH`, which is chosen against this number.
 */
export const maxDuration = 60;

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
 * What it still does not close: geocoding writes nothing, so the server cannot
 * see how far an import has already got, and `runTotal` is a number the client
 * chose. A scripted caller can understate it, or re-send chunk after chunk that
 * each fit the headroom on their own. Bounding that needs a per-user counter
 * with somewhere durable to live, which is a bigger change than this one and is
 * worth making before signup is open to strangers.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, geocodeBatchSchema);

  await assertPlaceHeadroom(
    ctx,
    params.id,
    Math.max(input.runTotal ?? 0, input.rows.length),
  );

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
  }
});
