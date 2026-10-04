import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsCover } from "@/components/news/news-cover";
import { NewsMarkdown } from "@/components/news/news-markdown";
import { NewsDate } from "@/components/news/news-meta";
import { NewsProse } from "@/components/news/news-prose";
import { publishedNewsBySlug } from "@/lib/news/public";
import { NEWS_CATEGORY_LABELS } from "@/lib/news/types";
import { NEWS_SLUG_MAX, NEWS_SLUG_PATTERN } from "@/lib/validation/news.schema";

/**
 * One post: a centred header (category, title, date), a wide cover, then a
 * narrow serif reading column. Drafts, scheduled posts and unknown addresses
 * are all a 404 — the public lookup only finds what is on the site now.
 * docs/notes/news.md.
 */

async function findPost(slug: string) {
  // An address no post could have is not worth a lookup.
  if (slug.length > NEWS_SLUG_MAX || !NEWS_SLUG_PATTERN.test(slug)) return null;

  return publishedNewsBySlug(slug);
}

export async function generateMetadata(props: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await findPost(slug);

  if (!post) return { title: "News" };

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.publishedAt ?? undefined,
      ...(post.coverUrl ? { images: [{ url: post.coverUrl, alt: post.coverAlt || post.title }] } : {}),
    },
  };
}

export default async function NewsArticlePage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  const post = await findPost(slug);

  if (!post) notFound();

  return (
    <article className="w-full px-5 pt-12 pb-16 sm:px-8 sm:pt-20">
      <header className="mx-auto max-w-4xl space-y-6 text-center">
        <p className="text-sm font-semibold text-foreground">{NEWS_CATEGORY_LABELS[post.category]}</p>
        <h1 className="text-4xl/[1.1] font-semibold tracking-tight text-balance text-foreground sm:text-6xl/[1.05]">
          {post.title}
        </h1>
        <NewsDate iso={post.publishedAt} className="block text-sm text-foreground/80" />
      </header>

      {post.coverUrl ? (
        <NewsCover
          url={post.coverUrl}
          alt={post.coverAlt}
          category={post.category}
          priority
          className="mx-auto mt-12 max-w-5xl rounded-3xl sm:mt-16"
        />
      ) : null}

      <div className="mx-auto mt-12 max-w-2xl sm:mt-16">
        <NewsProse>
          <NewsMarkdown markdown={post.body} />
        </NewsProse>

        <div className="mt-16 border-t border-border pt-6">
          <Link href="/news" className="rounded-sm text-sm text-muted hover:text-foreground">
            ← All news
          </Link>
        </div>
      </div>
    </article>
  );
}
