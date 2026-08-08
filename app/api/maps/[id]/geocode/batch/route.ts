import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { getGeocoder, statusFor } from "@/lib/geocoding";
import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import { getMap } from "@/lib/repositories/maps.repository";
import { geocodeBatchSchema } from "@/lib/validation/geocode.schema";

type Params = { id: string };

/**
 * Geocodes a chunk of an import.
 *
 * Nothing is written here — results go back to the client for the review step,
 * and only a confirmed review creates places. That is CLAUDE.md §7's "never save
 * geocode results silently", enforced by the endpoint having no write path at all.
 *
 * One row failing must not fail the chunk: a single unresolvable address in a
 * 500-row CSV would otherwise block the whole import.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, geocodeBatchSchema);
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

    return ok({ results });
  } catch (error) {
    return geocoderFailure(error);
  }
});
