import Link from "next/link";

import { newsHref, type NewsPost } from "@/lib/news/types";
import { NewsMeta } from "./news-meta";

/** One post in the column beside the featured one: text only, ruled apart. */
export function NewsSideItem({ post }: { post: NewsPost }) {
  return (
    <Link href={newsHref(post.slug)} className="group block space-y-2 rounded-sm py-5 first:pt-0">
      <NewsMeta category={post.category} publishedAt={post.publishedAt} />
      <h3 className="text-xl/snug font-semibold tracking-tight text-balance text-foreground group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
        {post.title}
      </h3>
      <p className="line-clamp-4 font-serif text-[0.9375rem]/[1.6] text-pretty text-foreground/80">
        {post.summary}
      </p>
    </Link>
  );
}
