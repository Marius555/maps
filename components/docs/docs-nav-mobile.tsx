"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { DOCS_ARTICLES, docsHref } from "@/lib/docs/articles";

import { DocsNavList } from "./docs-nav-list";

/**
 * The guides below `lg`: one row naming the guide being read, which opens the
 * full list in place.
 *
 * It used to be the whole list stacked above the article — thirteen links a
 * phone reader scrolled past before the first line of the guide. In the flow
 * rather than an overlay, because `MarketingMain` transforms during a route
 * change and nothing inside it may be `position: fixed` (docs/notes/marketing.md).
 *
 * Shut again after a guide is picked: the open state remembers the path it was
 * opened on, so a navigation closes it without an effect.
 */
export function DocsNavMobile() {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const isOpen = openOn === pathname;

  const current =
    DOCS_ARTICLES.find((article) => docsHref(article.slug) === pathname)?.title ??
    "Overview";

  return (
    <nav aria-label="Documentation" className="lg:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="docs-nav-mobile-list"
        onClick={() => setOpenOn(isOpen ? null : pathname)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm"
      >
        <span className="min-w-0 truncate">
          <span className="text-muted">Guides · </span>
          <span className="font-medium text-foreground">{current}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id="docs-nav-mobile-list"
        hidden={!isOpen}
        className="mt-2 rounded-xl border border-border bg-surface p-2"
      >
        <DocsNavList idPrefix="docs-nav-mobile" />
      </div>
    </nav>
  );
}
