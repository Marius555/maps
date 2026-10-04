"use client";

import Link from "next/link";

import { NEWS_CATEGORY_LABELS, newsHref, type NewsPost } from "@/lib/news/types";
import { formatNewsDate } from "../news-meta";

/**
 * Every post as a ruled table: date, category, title. Below `sm` the first two
 * columns fold into one small line above the title, so a phone never scrolls
 * sideways.
 *
 * Pointing at or focusing a row names it to the preview card beside the table.
 */
export function NewsIndexTable({
  posts,
  onActive,
}: {
  posts: NewsPost[];
  onActive: (id: string) => void;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead className="max-sm:sr-only">
        <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
          <th scope="col" className="w-[22%] pb-4 font-normal">
            Date
          </th>
          <th scope="col" className="w-[22%] pb-4 font-normal">
            Category
          </th>
          <th scope="col" className="pb-4 font-normal">
            Title
          </th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => {
          const date = formatNewsDate(post.publishedAt);
          const category = NEWS_CATEGORY_LABELS[post.category];

          return (
            <tr
              key={post.id}
              onPointerEnter={() => onActive(post.id)}
              onFocus={() => onActive(post.id)}
              className="group border-b border-border align-top"
            >
              <td className="py-4 pr-4 text-sm text-muted max-sm:hidden">
                {post.publishedAt ? <time dateTime={post.publishedAt}>{date}</time> : null}
              </td>
              <td className="py-4 pr-4 text-sm text-muted max-sm:hidden">{category}</td>
              <td className="py-4">
                <span className="mb-1 block text-xs text-muted sm:hidden">
                  {date} · {category}
                </span>
                <Link
                  href={newsHref(post.slug)}
                  className="rounded-sm font-serif text-base/snug text-foreground/75 transition-colors group-hover:text-foreground hover:underline hover:decoration-1 hover:underline-offset-4"
                >
                  {post.title}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
