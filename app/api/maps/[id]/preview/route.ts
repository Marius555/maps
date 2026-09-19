import { ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { buildPreviewData } from "@/lib/map-preview/preview-data";
import { listAllGroups } from "@/lib/repositories/groups.repository";
import { getMap } from "@/lib/repositories/maps.repository";
import { listAllPlaces } from "@/lib/repositories/places.repository";
import { listAllShapes } from "@/lib/repositories/shapes.repository";

type Params = { id: string };

/**
 * What the maps list draws one map's preview from.
 *
 * Asked only when a card has no cached picture, or its picture is out of date
 * (lib/map-preview/version.ts) — so a returning owner costs this nothing. Every
 * colour is resolved here, against the groups, so the browser only has to draw.
 *
 * Dashboard only. Nothing here is in a visitor's path (CLAUDE.md §2).
 */
export const GET = withAuth<Params>(async ({ params, ctx }) => {
  const [map, places, shapes, groups] = await Promise.all([
    getMap(ctx, params.id),
    listAllPlaces(ctx, params.id),
    listAllShapes(ctx, params.id),
    listAllGroups(ctx, params.id),
  ]);

  return ok(buildPreviewData({ map, places, shapes, groups }));
});
