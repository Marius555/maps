import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import {
  getPublishedNewsBySlug,
  listPublishedNews,
} from "@/lib/repositories/news.repository";
import type { NewsCategory, NewsPost } from "./types";

/**
 * What /news reads — the repository's public lookups, cached so a page view is
 * not an Appwrite request. docs/notes/news.md.
 *
 * - **Five minutes** is the longest a scheduled post can wait to appear after
 *   its time: the query decides "published", so a cached answer is a minute or
 *   five behind the clock and never wrong about anything else.
 * - **Every console write calls `revalidateNews()`**, so publishing, editing,
 *   unpublishing and deleting show on the next view rather than after the five
 *   minutes. `expire: 0` is the point of it — `"max"` would serve the stale page
 *   once more, which is the old post to the very person who just changed it.
 * - A thrown error is not cached, so an Appwrite wobble heals on the next request.
 */

const NEWS_TAG = "news";
const REVALIDATE_SECONDS = 300;

const cachedList = unstable_cache(
  (category: NewsCategory | "all") => listPublishedNews(category === "all" ? undefined : category),
  ["news-list"],
  { tags: [NEWS_TAG], revalidate: REVALIDATE_SECONDS },
);

const cachedBySlug = unstable_cache(
  (slug: string) => getPublishedNewsBySlug(slug),
  ["news-by-slug"],
  { tags: [NEWS_TAG], revalidate: REVALIDATE_SECONDS },
);

export function publishedNews(category?: NewsCategory): Promise<NewsPost[]> {
  return cachedList(category ?? "all");
}

export function publishedNewsBySlug(slug: string): Promise<NewsPost | null> {
  return cachedBySlug(slug);
}

/** Drop every cached /news answer. Called by each `/api/admin/news` write. */
export function revalidateNews(): void {
  revalidateTag(NEWS_TAG, { expire: 0 });
}
