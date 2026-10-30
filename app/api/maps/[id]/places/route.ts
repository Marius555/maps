import { created, ok } from "@/lib/api/responses";
import { parseBody, withMapAuth } from "@/lib/api/route";
import { createPlace, listPlaces } from "@/lib/repositories/places.repository";
import { paginationSchema } from "@/lib/validation/common";
import { createPlaceSchema } from "@/lib/validation/place.schema";

type Params = { id: string };

export const GET = withMapAuth<Params>(async ({ request, params, ctx }) => {
  const search = request.nextUrl.searchParams;
  const { cursor, limit } = paginationSchema.parse({
    cursor: search.get("cursor"),
    limit: search.get("limit") ?? undefined,
  });

  const page = await listPlaces(ctx, params.id, { cursor, limit });

  return ok({
    places: page.items,
    nextCursor: page.nextCursor,
    total: page.total,
  });
});

export const POST = withMapAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, createPlaceSchema);
  return created({ place: await createPlace(ctx, params.id, input) });
});
