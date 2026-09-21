import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { getGeocoder } from "@/lib/geocoding";
import { getMap } from "@/lib/repositories/maps.repository";
import {
  assertLookupHeadroom,
  recordLookups,
} from "@/lib/repositories/usage.repository";
import { reverseGeocodeSchema } from "@/lib/validation/geocode.schema";

type Params = { id: string };

/**
 * Coordinates → the address there.
 *
 * Called when someone drops a pin on the editor's map, so the location arrives
 * with a street name instead of "Location 3" and a pair of coordinates. That is
 * an owner action inside the dashboard, not a visitor one — CLAUDE.md §2 bars
 * metered calls from the *visitor's* path, and this is on the other side of it.
 *
 * Scoped under a map the caller owns for the same reason as the forward route:
 * an unscoped geocoding endpoint is a free proxy for anyone who finds it.
 *
 * **Counted as one lookup, though on Geoapify it can be two requests.** That
 * adapter asks a second time for the street when the nearest building does not
 * settle it, and the meter does not model that: it counts what the *caller* asked
 * for, not what the adapter needed to answer it, because the allowance is a
 * promise to the customer and the customer asked once. The slack is paid for by
 * `LOOKUP_LIMITS` being sized above full entitlement — see its docblock.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, reverseGeocodeSchema);

  await assertLookupHeadroom(ctx.userId, 1, "interactive");

  try {
    const candidate = await getGeocoder().reverse(input);

    await recordLookups(ctx.userId, 1);

    // Null, not a 404: open water and unmapped roads are ordinary answers here,
    // and the caller's response to both is to leave the address blank.
    return ok({ candidate });
  } catch (error) {
    return geocoderFailure(error);
  }
});
