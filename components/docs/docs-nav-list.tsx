"use client";

import { BookOpen, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCS_GROUPS, articlesInGroup, docsHref } from "@/lib/docs/articles";

/**
 * Every guide, grouped under the same headings as the hub — the body of both
 * the desktop rail and the phone's disclosure, so the two cannot disagree.
 *
 * Twelve guides in one flat list is a list you read top to bottom to find
 * anything; four short ones you scan. Each row carries its guide's icon, the
 * same one its hub card wears, so the two views look like one set.
 *
 * `idPrefix` keeps the group headings' ids unique while both copies are in the
 * document (one is always `display: none`, but ids are document-wide).
 */
export function DocsNavList({ idPrefix }: { idPrefix: string }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <DocsNavLink href="/docs" icon={BookOpen} isCurrent={pathname === "/docs"}>
        Overview
      </DocsNavLink>

      {DOCS_GROUPS.map((group) => (
        <div key={group}>
          <h3
            id={`${idPrefix}-${group}`}
            className="px-2.5 pb-1.5 text-[0.6875rem] font-medium tracking-wide text-muted uppercase"
          >
            {group}
          </h3>

          <ul aria-labelledby={`${idPrefix}-${group}`} className="space-y-0.5">
            {articlesInGroup(group).map((article) => (
              <li key={article.slug}>
                <DocsNavLink
                  href={docsHref(article.slug)}
                  icon={article.icon}
                  isCurrent={pathname === docsHref(article.slug)}
                >
                  {article.title}
                </DocsNavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Active state is foreground text on a quiet fill, as in the dashboard sidebar. */
function DocsNavLink({
  href,
  icon: Icon,
  isCurrent,
  children,
}: {
  href: string;
  icon: LucideIcon;
  isCurrent: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium transition-[color,background-color] duration-[var(--duration-fast)] ${
        isCurrent
          ? "bg-default/70 text-foreground"
          : "text-muted hover:bg-default/40 hover:text-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </Link>
  );
}
