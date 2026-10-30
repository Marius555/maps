import { created } from "@/lib/api/responses";
import { parseBody, withMapAuth } from "@/lib/api/route";
import { createPlaces } from "@/lib/repositories/places.repository";
import { bulkCreatePlacesSchema } from "@/lib/validation/place.schema";

type Params = { id: string };

/** The confirm step of a CSV import. Plan limits are enforced in the repository. */
export const POST = withMapAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, bulkCreatePlacesSchema);
  const places = await createPlaces(ctx, params.id, input.places);

  return created({ places, count: places.length });
});
