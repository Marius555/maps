import { BookOpen, Mail, Tag } from "lucide-react";
import Link from "next/link";

import { newsroomLinks, type NewsroomLink } from "@/lib/news/newsroom-links";

const ICONS = { mail: Mail, book: BookOpen, tag: Tag } satisfies Record<NewsroomLink["icon"], unknown>;

/**
 * The top of /news: a large title, and under it one ruled row of where to go
 * next — a label over a link in each cell. The cells stack below `sm`. The
 * row's own rules close the header, so the header draws none of its own.
 */
export function NewsroomHeader() {
  const links = newsroomLinks();

  return (
    <header className="space-y-8 pb-12 md:space-y-10 md:pb-16">
      <h1 className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
        Newsroom
      </h1>

      {links.length > 0 ? (
        <dl className="grid divide-y divide-border border-y border-border text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {links.map((link) => {
            const Icon = ICONS[link.icon];
            const content = (
              <>
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{link.text}</span>
              </>
            );
            const className =
              "inline-flex max-w-full items-center gap-2 rounded-sm text-foreground transition-colors hover:text-accent";

            return (
              <div
                key={link.label}
                className="min-w-0 space-y-1.5 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0"
              >
                <dt className="text-xs text-muted">{link.label}</dt>
                <dd className="min-w-0">
                  {/* A mail link is not a route: a plain anchor, not the router. */}
                  {link.href.startsWith("mailto:") ? (
                    <a href={link.href} className={className}>
                      {content}
                    </a>
                  ) : (
                    <Link href={link.href} className={className}>
                      {content}
                    </Link>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </header>
  );
}
