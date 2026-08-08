import { created, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { createMap, listMaps } from "@/lib/repositories/maps.repository";
import { createMapSchema } from "@/lib/validation/map.schema";

export const GET = withAuth(async ({ ctx }) => ok({ maps: await listMaps(ctx) }));

export const POST = withAuth(async ({ request, ctx }) => {
  const input = await parseBody(request, createMapSchema);
  return created({ map: await createMap(ctx, input) });
});
