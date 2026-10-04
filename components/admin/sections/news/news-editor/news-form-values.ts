import { isoToWallClock } from "@/lib/format/wall-clock";
import type { NewsPost } from "@/lib/news/types";
import type { AdminNewsForm } from "@/lib/validation/news.schema";

export const EMPTY_NEWS: AdminNewsForm = {
  title: "",
  slug: "",
  summary: "",
  body: "",
  category: "announcements",
  coverAlt: "",
  status: "draft",
  publishedAt: "",
};

/** A saved post as the editor's form holds it — dates in the admin's own clock. */
export function formFromPost(post: NewsPost): AdminNewsForm {
  return {
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    body: post.body,
    category: post.category,
    coverAlt: post.coverAlt,
    status: post.publishedAt ? "published" : "draft",
    publishedAt: isoToWallClock(post.publishedAt),
  };
}
