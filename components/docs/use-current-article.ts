"use client";

import { usePathname } from "next/navigation";

import { DOCS_ARTICLES, docsHref } from "@/lib/docs/articles";

/**
 * Where in `DOCS_ARTICLES` the guide being read sits, or -1 on the hub.
 *
 * Read from the URL rather than handed down by each page, for the reason
 * `DocsNav` gives: one more prop on twelve pages is twelve more places to get
 * it wrong when a guide is added.
 */
export function useCurrentArticleIndex(): number {
  const pathname = usePathname();
  return DOCS_ARTICLES.findIndex((article) => docsHref(article.slug) === pathname);
}
