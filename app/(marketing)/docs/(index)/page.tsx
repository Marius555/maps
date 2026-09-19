import type { Metadata } from "next";

import { DocsCard } from "@/components/docs/docs-card";
import { DOCS_ARTICLES } from "@/lib/docs/articles";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to get your locations into a map, style it, and put it on your own site.",
};

/**
 * The hub.
 *
 * In its own `(index)` route group for the reason `maps/(list)` and
 * `places/(list)` are: a `loading.tsx` covers its segment's page *and every
 * route below it*, so a page with routes beneath it sits in a group of its own
 * (docs/notes/editor-and-layout.md). These pages are static and will not need
 * one — the group is what keeps that true if a later one does.
 *
 * Only guides that exist are listed. Placeholder cards for guides that don't
 * are a list of dead ends, and the sentence below says the same thing honestly.
 */
export default function DocsIndexPage() {
  return (
    <div className="min-w-0 flex-1">
      <header className="space-y-3 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          Documentation
        </h1>
        <p className="max-w-2xl text-pretty text-muted">
          How to get your locations onto a map and onto your own site.
        </p>
      </header>

      <ul className="max-w-2xl space-y-3">
        {DOCS_ARTICLES.map((article) => (
          <li key={article.slug}>
            <DocsCard article={article} />
          </li>
        ))}
      </ul>

      <p className="max-w-2xl pt-8 text-sm/6 text-muted">
        More pages are on the way — styling pins and tags, publishing, and
        embedding your map.
      </p>
    </div>
  );
}
