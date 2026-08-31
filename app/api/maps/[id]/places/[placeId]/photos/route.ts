import { z } from "zod";

import { fail, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  addPlacePhotos,
  clearPlacePhotos,
  reorderPlacePhotos,
} from "@/lib/repositories/files.repository";

type Params = { id: string; placeId: string };

/**
 * The order the gallery is in — which is also which photo is the cover, since
 * the cover is the first one. Ids only: the repository rejects anything that is
 * not a permutation of what the row already holds, so this can never be a second
 * route for adding or dropping a photo.
 */
const reorderSchema = z.object({
  photoIds: z.array(z.string().trim().min(1).max(36)),
});

/**
 * Multipart, so this is the one route that doesn't take JSON. Files go straight
 * from the browser to us to Appwrite Storage — nothing is written to disk here.
 *
 * `getAll`, not `get`: the picker is `multiple`, and a visitor choosing four
 * photos should be four uploads and one row write rather than four round trips.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  let files: FormDataEntryValue[];

  try {
    files = (await request.formData()).getAll("photo");
  } catch {
    return fail(
      "validation_failed",
      "That upload was malformed. Choose the photos again and retry.",
      422,
    );
  }

  const photos = files.filter((file): file is File => file instanceof File);

  if (photos.length === 0) {
    return fail("validation_failed", "Choose a photo to upload.", 422);
  }

  const place = await addPlacePhotos(ctx, params.id, params.placeId, photos);

  return ok({ place });
});

export const PATCH = withAuth<Params>(async ({ request, params, ctx }) => {
  const { photoIds } = await parseBody(request, reorderSchema);

  return ok({
    place: await reorderPlacePhotos(ctx, params.id, params.placeId, photoIds),
  });
});

export const DELETE = withAuth<Params>(async ({ params, ctx }) =>
  ok({ place: await clearPlacePhotos(ctx, params.id, params.placeId) }),
);
