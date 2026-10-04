import "server-only";

import { requireAdmin } from "@/lib/admin/auth/guard";
import { newsStatus, type NewsPost, type NewsStatus } from "@/lib/news/types";
import { getNews, listAllNews } from "@/lib/repositories/news.repository";

export type NewsTableRow = NewsPost & { status: NewsStatus };

/** What the console's News page lists: every post, drafts included. */
export async function loadAllNews(): Promise<NewsTableRow[]> {
  await requireAdmin();

  const now = Date.now();

  return (await listAllNews()).map((post) => ({ ...post, status: newsStatus(post.publishedAt, now) }));
}

/** One post for the editor. A missing id throws the repository's 404. */
export async function loadNewsPost(id: string): Promise<NewsPost> {
  await requireAdmin();

  return getNews(id);
}
