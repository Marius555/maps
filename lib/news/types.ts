/**
 * Posts on the public /news page. docs/notes/news.md.
 *
 * A plain module: the public pages, the console's editor and the repository all
 * read these, and a `"use client"` file would hand a server component a
 * reference rather than the arrays (CLAUDE.md, "Stack specifics").
 */

/** What a post is filed under. Hand-copied into scripts/appwrite-schema.mjs. */
export const NEWS_CATEGORIES = ["announcements", "product", "company"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  announcements: "Announcements",
  product: "Product",
  company: "Company",
};

export function isNewsCategory(value: unknown): value is NewsCategory {
  return (NEWS_CATEGORIES as readonly unknown[]).includes(value);
}

/** One post, as both the console and the public pages read it. */
export type NewsPost = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  /** GitHub-flavoured Markdown. Raw HTML is never rendered. */
  body: string;
  category: NewsCategory;
  /** Public URL of the cover image, composed on the server. Null for none. */
  coverUrl: string | null;
  coverAlt: string;
  /** Null is a draft; a future time is scheduled. */
  publishedAt: string | null;
  updatedAt: string;
};

export type NewsStatus = "draft" | "scheduled" | "published";

/** Whether a post is on the site at `now`. */
export function newsStatus(publishedAt: string | null, now: number = Date.now()): NewsStatus {
  if (!publishedAt) return "draft";

  return Date.parse(publishedAt) > now ? "scheduled" : "published";
}

/** Where a post lives on the site. */
export function newsHref(slug: string): string {
  return `/news/${slug}`;
}
