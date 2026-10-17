"use client";

import { DOCS_ARTICLES } from "@/lib/docs/articles";

import { useCurrentArticleIndex } from "./use-current-article";

/**
 * The guide's group above its title — "Build", "Publish" — so a reader who
 * arrived from a search result knows which part of the set they are in.
 * Drawn nothing on a path that is not a guide.
 */
export function DocsEyebrow() {
  const index = useCurrentArticleIndex();
  const article = DOCS_ARTICLES[index];
  if (!article) return null;

  return (
    <p className="text-xs font-semibold tracking-wide text-muted uppercase">
      Docs <span aria-hidden="true">/</span> {article.group}
    </p>
  );
}
