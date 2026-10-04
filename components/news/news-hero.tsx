import Link from "next/link";

import { newsHref, type NewsPost } from "@/lib/news/types";
import { NewsCover } from "./news-cover";
import { NewsMeta } from "./news-meta";
import { NewsSideItem } from "./news-side-item";

/**
 * The newest post given two thirds of the page — a large cover, then its title
 * beside its category, date and summary — and the next few as a text column on
 * the right. With nothing beside it, the featured post takes the full width.
 */
export function NewsHero({ featured, side }: { featured: NewsPost; side: NewsPost[] }) {
  const href = newsHref(featured.slug);

  return (
    <section
      aria-label="Latest news"
      className={`grid gap-10 border-b border-border py-12 md:py-16 ${
        side.length > 0 ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8" : ""
      }`}
    >
      <article className="min-w-0 space-y-8">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
          <NewsCover
            url={featured.coverUrl}
            alt=""
            category={featured.category}
            priority
            className="rounded-2xl"
          />
        </Link>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
          <h2 className="text-3xl/[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-4xl/[1.15]">
            <Link
              href={href}
              className="rounded-sm hover:underline hover:decoration-2 hover:underline-offset-4"
            >
              {featured.title}
            </Link>
          </h2>

          <div className="space-y-2">
            <NewsMeta category={featured.category} publishedAt={featured.publishedAt} />
            <p className="font-serif text-base/[1.6] text-pretty text-foreground/80">
              {featured.summary}
            </p>
          </div>
        </div>
      </article>

      {side.length > 0 ? (
        <div className="min-w-0 divide-y divide-border">
          {side.map((post) => (
            <NewsSideItem key={post.id} post={post} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
