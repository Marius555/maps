import { fail, ok } from "@/lib/api/responses";
import { withAdmin } from "@/lib/api/route";
import { assertUploadSize } from "@/lib/api/upload-size";
import { revalidateNews } from "@/lib/news/public";
import { clearNewsCover, setNewsCover } from "@/lib/repositories/news.repository";

type Params = { id: string };

/**
 * A post's cover image — one file, so PUT replaces and DELETE means "the one it
 * has". Multipart, on the pattern of a location's logo route.
 */
export const PUT = withAdmin<Params>(async (request, { id }) => {
  assertUploadSize(request, "cover");

  let entry: FormDataEntryValue | null;

  try {
    entry = (await request.formData()).get("cover");
  } catch {
    return fail("validation_failed", "That upload was malformed. Choose the image again and retry.", 422);
  }

  if (!(entry instanceof File)) {
    return fail("validation_failed", "Choose a cover image to upload.", 422);
  }

  const post = await setNewsCover(id, entry);
  revalidateNews();

  return ok(post);
});

export const DELETE = withAdmin<Params>(async (_request, { id }) => {
  const post = await clearNewsCover(id);
  revalidateNews();

  return ok(post);
});
