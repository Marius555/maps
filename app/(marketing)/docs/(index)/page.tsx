import type { Metadata } from "next";

import { DocsCard } from "@/components/docs/docs-card";
import { DOCS_GROUPS, articlesInGroup } from "@/lib/docs/articles";

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
 * are a list of dead ends.
 *
 * Cards sit in a grid rather than one column, so the hub fills the width beside
 * the rail the way the guides do instead of leaving its right half empty.
 */
export default function DocsIndexPage() {
  return (
    <div className="min-w-0 flex-1">
      <header className="space-y-3 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          Documentation
        </h1>
        <p className="text-pretty text-muted">
          How to get your locations onto a map and onto your own site. New here?
          Start with Getting started, then read the rest in any order.
        </p>
      </header>

      <div className="space-y-10">
        {DOCS_GROUPS.map((group) => (
          <section key={group} aria-labelledby={`docs-group-${group}`}>
            <h2
              id={`docs-group-${group}`}
              className="pb-3 text-[0.6875rem] font-medium tracking-wide text-muted uppercase"
            >
              {group}
            </h2>

            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {articlesInGroup(group).map((article) => (
                <li key={article.slug} className="flex">
                  <DocsCard article={article} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
