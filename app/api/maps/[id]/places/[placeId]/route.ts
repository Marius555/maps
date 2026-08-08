import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  deletePlace,
  getPlace,
  updatePlace,
} from "@/lib/repositories/places.repository";
import { updatePlaceSchema } from "@/lib/validation/place.schema";

type Params = { id: string; placeId: string };

export const GET = withAuth<Params>(async ({ params, ctx }) =>
  ok({ place: await getPlace(ctx, params.id, params.placeId) }),
);

export const PATCH = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, updatePlaceSchema);
  return ok({ place: await updatePlace(ctx, params.id, params.placeId, input) });
});

export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  await deletePlace(ctx, params.id, params.placeId);
  return noContent();
});
