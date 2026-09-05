import { fail, ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import {
  clearPlaceLogo,
  setPlaceLogo,
} from "@/lib/repositories/files.repository";

type Params = { id: string; placeId: string };

/**
 * This location's own brand mark.
 *
 * The gallery's route next door, with one file instead of many — so `get` rather
 * than `getAll`, and a POST that *replaces* rather than appends. A location has
 * one logo, which is why there is no `[logoId]` route under this one: there is
 * never a second to name, and DELETE means "the one it has".
 *
 * Multipart, so this is the second route that doesn't take JSON. The file goes
 * straight from the browser through us to Appwrite Storage; nothing touches
 * disk here.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  let entry: FormDataEntryValue | null;

  try {
    entry = (await request.formData()).get("logo");
  } catch {
    return fail(
      "validation_failed",
      "That upload was malformed. Choose the logo again and retry.",
      422,
    );
  }

  if (!(entry instanceof File)) {
    return fail("validation_failed", "Choose a logo to upload.", 422);
  }

  return ok({ place: await setPlaceLogo(ctx, params.id, params.placeId, entry) });
});

export const DELETE = withAuth<Params>(async ({ params, ctx }) =>
  ok({ place: await clearPlaceLogo(ctx, params.id, params.placeId) }),
);
