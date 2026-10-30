import { ok } from "@/lib/api/responses";
import { withMapAuth } from "@/lib/api/route";
import { removePlacePhoto } from "@/lib/repositories/files.repository";

type Params = { id: string; placeId: string; photoId: string };

/**
 * Removes one photo. Returns the place rather than 204, because the caller needs
 * the new gallery — dropping the cover promotes the next photo, and the row is
 * the only thing that knows which that is.
 */
export const DELETE = withMapAuth<Params>(async ({ params, ctx }) =>
  ok({
    place: await removePlacePhoto(
      ctx,
      params.id,
      params.placeId,
      params.photoId,
    ),
  }),
);
