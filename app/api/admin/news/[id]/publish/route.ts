import { ok } from "@/lib/api/responses";
import { withAdmin } from "@/lib/api/route";
import { revalidateNews } from "@/lib/news/public";
import { setNewsPublishedAt } from "@/lib/repositories/news.repository";

type Params = { id: string };

/**
 * The console's row menu: put a post on the site now, or take it off. A toggle
 * pair like the discount `feature` route, so publishing never needs the whole
 * form sent back.
 */
export const PUT = withAdmin<Params>(async (_request, { id }) => {
  const post = await setNewsPublishedAt(id, new Date().toISOString());
  revalidateNews();

  return ok(post);
});

export const DELETE = withAdmin<Params>(async (_request, { id }) => {
  const post = await setNewsPublishedAt(id, null);
  revalidateNews();

  return ok(post);
});
