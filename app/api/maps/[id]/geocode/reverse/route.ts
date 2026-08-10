import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { getGeocoder } from "@/lib/geocoding";
import { getMap } from "@/lib/repositories/maps.repository";
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
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, reverseGeocodeSchema);

  try {
    const candidate = await getGeocoder().reverse(input);

    // Null, not a 404: open water and unmapped roads are ordinary answers here,
    // and the caller's response to both is to leave the address blank.
    return ok({ candidate });
  } catch (error) {
    return geocoderFailure(error);
  }
});
