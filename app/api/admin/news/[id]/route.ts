import { answeringSlugClash } from "@/lib/api/news-slug";
import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withAdmin } from "@/lib/api/route";
import { revalidateNews } from "@/lib/news/public";
import { deleteNews, updateNews } from "@/lib/repositories/news.repository";
import { adminNewsFormSchema, newsInputSchema, toNewsInput } from "@/lib/validation/news.schema";

type Params = { id: string };

/** Save the editor's form over this post — every field, the way `POST` writes them. */
export const PATCH = withAdmin<Params>(async (request, { id }) => {
  const form = await parseBody(request, adminNewsFormSchema);
  const input = await newsInputSchema.parseAsync(toNewsInput(form));

  return answeringSlugClash(async () => {
    const post = await updateNews(id, input);
    revalidateNews();

    return ok(post);
  });
});

/** Delete the post and its cover image. */
export const DELETE = withAdmin<Params>(async (_request, { id }) => {
  await deleteNews(id);
  revalidateNews();

  return noContent();
});
