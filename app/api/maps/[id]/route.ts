import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  deleteMap,
  getMap,
  updateMap,
} from "@/lib/repositories/maps.repository";
import { updateMapSchema } from "@/lib/validation/map.schema";

type Params = { id: string };

export const GET = withAuth<Params>(async ({ params, ctx }) =>
  ok({ map: await getMap(ctx, params.id) }),
);

export const PATCH = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, updateMapSchema);
  return ok({ map: await updateMap(ctx, params.id, input) });
});

export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  await deleteMap(ctx, params.id);
  return noContent();
});
