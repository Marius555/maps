import Link from "next/link";

import type { DocsArticle } from "@/lib/docs/articles";
import { docsHref } from "@/lib/docs/articles";

/**
 * One guide on the hub.
 *
 * The whole card is the link rather than a title inside it — a card with a
 * pressable strip at the top is a target most people miss on the first try, and
 * on a phone the miss lands on nothing at all.
 */
export function DocsCard({ article }: { article: DocsArticle }) {
  const { icon: Icon, title, summary, slug } = article;

  return (
    <Link
      href={docsHref(slug)}
      className="flex gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors duration-[var(--duration-fast)] hover:border-border-secondary hover:bg-default/40"
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-default text-foreground"
      >
        <Icon className="size-4.5" />
      </span>

      <span className="min-w-0 space-y-1">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-pretty text-sm/6 text-muted">{summary}</span>
      </span>
    </Link>
  );
}
