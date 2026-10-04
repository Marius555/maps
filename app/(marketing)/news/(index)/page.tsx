import type { Metadata } from "next";

import { NewsHero } from "@/components/news/news-hero";
import { NewsIndex } from "@/components/news/news-index/news-index";
import { NewsroomHeader } from "@/components/news/newsroom-header";
import { publishedNews } from "@/lib/news/public";
import type { NewsPost } from "@/lib/news/types";

export const metadata: Metadata = {
  title: "News",
  description: "Product updates, announcements and company news.",
};

/** How many posts sit in the column beside the featured one. */
const SIDE_COUNT = 4;

/**
 * The Newsroom: a header with where to go next, the newest post featured with
 * the next few beside it, then every post in a searchable table.
 * docs/notes/news.md.
 *
 * In its own `(index)` group for the reason `docs/(index)` is: a `loading.tsx`
 * here must never also cover `/news/[slug]`. It reads no request input, so the
 * whole page is cached, and `revalidateNews()` purges it on every console write.
 */
export default async function NewsIndexPage() {
  let posts: NewsPost[] | null;
  try {
    posts = await publishedNews();
  } catch (error) {
    console.error("Couldn't read news posts", error);
    posts = null;
  }

  const [featured, ...rest] = posts ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-8 sm:px-8 sm:pt-16">
      <NewsroomHeader />

      {posts === null ? (
        <p className="py-16 text-center text-muted">
          The news couldn&apos;t be loaded just now. Refresh the page in a moment.
        </p>
      ) : !featured ? (
        <div className="mt-12 space-y-2 rounded-3xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-medium text-foreground">No news yet.</p>
          <p className="text-sm text-muted">Announcements and product updates will appear here.</p>
        </div>
      ) : (
        <>
          <NewsHero featured={featured} side={rest.slice(0, SIDE_COUNT)} />
          <NewsIndex posts={posts} />
        </>
      )}
    </div>
  );
}
