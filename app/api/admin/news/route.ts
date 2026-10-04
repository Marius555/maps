import { answeringSlugClash } from "@/lib/api/news-slug";
import { created } from "@/lib/api/responses";
import { parseBody, withAdmin } from "@/lib/api/route";
import { revalidateNews } from "@/lib/news/public";
import { createNews } from "@/lib/repositories/news.repository";
import { adminNewsFormSchema, newsInputSchema, toNewsInput } from "@/lib/validation/news.schema";

/**
 * Write a news post from the operator console. docs/notes/news.md.
 *
 * Parsed as the editor's form, then as `newsInputSchema`, which is where a
 * draft loses its publish time and an empty one becomes "now".
 */
export const POST = withAdmin(async (request) => {
  const form = await parseBody(request, adminNewsFormSchema);
  const input = await newsInputSchema.parseAsync(toNewsInput(form));

  return answeringSlugClash(async () => {
    const post = await createNews(input);
    revalidateNews();

    return created(post);
  });
});
