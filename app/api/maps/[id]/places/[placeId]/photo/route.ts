import { fail, ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import {
  clearPlacePhoto,
  setPlacePhoto,
} from "@/lib/repositories/files.repository";

type Params = { id: string; placeId: string };

/**
 * Multipart, so this is the one route that doesn't take JSON. The file goes
 * straight from the browser to us to Appwrite Storage — it is never written to
 * disk here.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  let file: FormDataEntryValue | null;

  try {
    file = (await request.formData()).get("photo");
  } catch {
    return fail(
      "validation_failed",
      "That upload was malformed. Choose the photo again and retry.",
      422,
    );
  }

  if (!(file instanceof File)) {
    return fail("validation_failed", "Choose a photo to upload.", 422);
  }

  const place = await setPlacePhoto(ctx, params.id, params.placeId, file);

  return ok({ place });
});

export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  const place = await clearPlacePhoto(ctx, params.id, params.placeId);

  return ok({ place });
});
