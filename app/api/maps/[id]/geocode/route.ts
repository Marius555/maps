import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { getGeocoder } from "@/lib/geocoding";
import { getMap } from "@/lib/repositories/maps.repository";
import {
  assertLookupHeadroom,
  recordLookups,
} from "@/lib/repositories/usage.repository";
import { geocodeSearchSchema } from "@/lib/validation/geocode.schema";

type Params = { id: string };

/**
 * Search-on-submit for one address (CLAUDE.md §7 — autocomplete is not in v1, so
 * this is one request per deliberate submit, not one per keystroke).
 *
 * Scoped under a map the caller owns on purpose: an unscoped geocoding endpoint
 * is a free proxy for anyone who finds it.
 *
 * `interactive`: somebody pressed enter and is watching the field. This spends the
 * day's shared budget to its last credit rather than standing aside at the reserve
 * — a sweep nobody asked for can wait, a person typing cannot.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, geocodeSearchSchema);

  await assertLookupHeadroom(ctx.userId, 1, "interactive");

  try {
    const candidates = await getGeocoder().search({
      address: input.address,
      countryCode: input.countryCode,
      limit: 5,
    });

    // After the answer, never around the request: a lookup the upstream refused
    // is not one the customer should have billed against their month.
    await recordLookups(ctx.userId, 1);

    return ok({ candidates });
  } catch (error) {
    return geocoderFailure(error);
  }
});
