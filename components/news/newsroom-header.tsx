import { BookOpen, Mail, Tag } from "lucide-react";
import Link from "next/link";

import { newsroomLinks, type NewsroomLink } from "@/lib/news/newsroom-links";

const ICONS = { mail: Mail, book: BookOpen, tag: Tag } satisfies Record<NewsroomLink["icon"], unknown>;

/**
 * The top of /news: a large title on the left and a short table of where to go
 * next on the right, ruled between rows. Stacks below `md`.
 */
export function NewsroomHeader() {
  const links = newsroomLinks();

  return (
    <header className="grid gap-8 border-b border-border pb-12 md:grid-cols-2 md:gap-12 md:pb-16">
      <h1 className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
        Newsroom
      </h1>

      {links.length > 0 ? (
        <dl className="divide-y divide-border border-y border-border text-sm">
          {links.map((link) => {
            const Icon = ICONS[link.icon];
            const content = (
              <>
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{link.text}</span>
              </>
            );
            const className =
              "inline-flex max-w-full items-center gap-2 rounded-sm text-muted transition-colors hover:text-foreground";

            return (
              <div key={link.label} className="grid grid-cols-2 gap-4 py-3">
                <dt className="text-muted">{link.label}</dt>
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
