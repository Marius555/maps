"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCS_ARTICLES, docsHref } from "@/lib/docs/articles";

/**
 * The list of guides, beside the one you are reading.
 *
 * The only client component in `components/docs/` — it needs `usePathname` to
 * mark the current guide, and nothing else here needs the browser at all.
 * Reading a hardcoded `current` prop down from each page instead would be a
 * second place to get the answer wrong every time a guide is added.
 *
 * Sticky from `lg`, where it has a column of its own. Below that it sits above
 * the article as an ordinary block: a sticky rail on a phone is a rail covering
 * the thing you came to read.
 */
export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="lg:sticky lg:top-8">
      <h2 className="px-2.5 pb-1 text-[0.6875rem] font-medium tracking-wide text-muted uppercase">
        Documentation
      </h2>

      <ul className="space-y-0.5">
        <li>
          <DocsNavLink href="/docs" isCurrent={pathname === "/docs"}>
            Overview
          </DocsNavLink>
        </li>

        {DOCS_ARTICLES.map((article) => (
          <li key={article.slug}>
            <DocsNavLink
              href={docsHref(article.slug)}
              isCurrent={pathname === docsHref(article.slug)}
            >
              {article.title}
            </DocsNavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Active state is weight plus a quiet fill, as in the dashboard sidebar. */
function DocsNavLink({
  href,
  isCurrent,
  children,
}: {
  href: string;
  isCurrent: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={`block rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-[color,background-color] duration-[var(--duration-fast)] ${
        isCurrent
          ? "bg-default font-medium text-foreground"
          : "text-muted hover:bg-default/60 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
