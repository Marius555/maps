"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

import { DOCS_ARTICLES, docsHref, type DocsArticle } from "@/lib/docs/articles";

import { useCurrentArticleIndex } from "./use-current-article";

/**
 * The guides before and after this one, at its foot.
 *
 * `DOCS_ARTICLES` is already written in reading order, so this is the set read
 * as a book: finish a guide and the next one is right there, without going back
 * up to the rail.
 */
export function DocsPager() {
  const index = useCurrentArticleIndex();
  if (index < 0) return null;

  const previous = DOCS_ARTICLES[index - 1];
  const next = DOCS_ARTICLES[index + 1];
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="More guides"
      className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2"
    >
      {previous && <PagerLink article={previous} direction="previous" />}
      {next && <PagerLink article={next} direction="next" />}
    </nav>
  );
}

function PagerLink({
  article,
  direction,
}: {
  article: DocsArticle;
  direction: "previous" | "next";
}) {
  const isNext = direction === "next";
  const Arrow = isNext ? ArrowRight : ArrowLeft;

  return (
    <Link
      href={docsHref(article.slug)}
      className={`group flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors duration-[var(--duration-fast)] hover:border-border-secondary hover:bg-default/30 ${
        isNext ? "sm:col-start-2 sm:items-end sm:text-right" : ""
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {!isNext && <Arrow aria-hidden="true" className="size-3.5" />}
        {isNext ? "Next" : "Previous"}
        {isNext && <Arrow aria-hidden="true" className="size-3.5" />}
      </span>
      <span className="text-sm font-medium text-foreground">{article.title}</span>
    </Link>
  );
}
