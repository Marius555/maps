"use client";

import { useState } from "react";

import { NEWS_CATEGORY_LABELS, type NewsPost } from "@/lib/news/types";
import { NewsIndexTable } from "./news-index-table";
import { NewsPreviewCard } from "./news-preview-card";
import { NewsSearchField } from "./news-search-field";

const PAGE = 10;

function matches(post: NewsPost, query: string): boolean {
  const haystack = `${post.title} ${post.summary} ${NEWS_CATEGORY_LABELS[post.category]}`.toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Every published post: a heading with a search box, the ruled table, "See
 * more", and the preview card. docs/notes/news.md.
 *
 * Search runs here, over the posts the page was rendered with (at most 100,
 * `news.repository.ts`), so typing costs no request and the page itself stays
 * fully cached.
 */
export function NewsIndex({ posts }: { posts: NewsPost[] }) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [activeId, setActiveId] = useState<string | null>(null);

  const found = query.trim() ? posts.filter((post) => matches(post, query)) : posts;
  const shown = found.slice(0, visible);
  const active = shown.find((post) => post.id === activeId) ?? shown[0];

  return (
    <section aria-labelledby="news-index-heading" className="space-y-8 py-12 md:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="news-index-heading"
          className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          News
        </h2>
        <NewsSearchField
          value={query}
          onChange={(next) => {
            setQuery(next);
            setVisible(PAGE);
          }}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {shown.length > 0 ? (
            <NewsIndexTable posts={shown} onActive={setActiveId} />
          ) : (
            <p className="border-y border-border py-10 text-center text-muted">
              No posts match &ldquo;{query.trim()}&rdquo;.{" "}
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-sm font-medium text-foreground underline underline-offset-4"
              >
                Clear the search
              </button>
            </p>
          )}

          {found.length > visible ? (
            <button
              type="button"
              onClick={() => setVisible((count) => count + PAGE)}
              className="mt-8 rounded-sm text-sm font-medium text-foreground underline decoration-1 underline-offset-4 hover:text-accent"
            >
              See more
            </button>
          ) : null}
        </div>

        <NewsPreviewCard post={active} />
      </div>
    </section>
  );
}
