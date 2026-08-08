import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { getGeocoder } from "@/lib/geocoding";
import { getMap } from "@/lib/repositories/maps.repository";
import { geocodeSearchSchema } from "@/lib/validation/geocode.schema";

type Params = { id: string };

/**
 * Search-on-submit for one address (CLAUDE.md §7 — autocomplete is not in v1, so
 * this is one request per deliberate submit, not one per keystroke).
 *
 * Scoped under a map the caller owns on purpose: an unscoped geocoding endpoint
 * is a free proxy for anyone who finds it.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, geocodeSearchSchema);

  try {
    const candidates = await getGeocoder().search({
      address: input.address,
      countryCode: input.countryCode,
      limit: 5,
    });

    return ok({ candidates });
  } catch (error) {
    return geocoderFailure(error);
  }
});
