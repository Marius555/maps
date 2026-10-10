"use client";

import { useEffect, useRef, useState } from "react";

type TocEntry = { id: string; title: string };

/**
 * How far below the top of the window a heading counts as "the one you are
 * reading": past `scroll-mt-8` (32px) with room for its first line.
 */
const READING_LINE_PX = 96;

/**
 * "On this page": the sections of the guide being read, beside it, with the
 * current one marked.
 *
 * **Read from the article, not passed in.** Every guide already names its
 * sections once, as `DocsSection`s; a second list handed to this would be a
 * second place to forget one. The entries arrive after hydration, which moves
 * nothing — the column they fill is reserved by `DocsArticle` either way.
 *
 * **The current section is the last heading above the reading line**, worked out
 * on scroll rather than with an IntersectionObserver: a long section whose
 * heading has left the window is still the one being read, and an observer only
 * reports what is on screen. At the foot of the page the last section wins, or a
 * short final section could never become current.
 *
 * Plain `#id` links, so the browser's own jump and `scroll-mt-8` do the work and
 * there is no smooth scroll for reduced motion to switch off.
 */
export function DocsToc() {
  const ref = useRef<HTMLElement>(null);
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const article = ref.current?.closest("article");
    if (!article) return;

    const sections = [...article.querySelectorAll<HTMLElement>("section[id]")];
    const found = sections.map((section) => ({
      id: section.id,
      title: section.querySelector("h2")?.textContent ?? section.id,
    }));

    let frame = 0;
    const update = () => {
      frame = 0;
      const atFoot =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = sections[0]?.id ?? null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= READING_LINE_PX) current = section.id;
      }
      setCurrentId(atFoot ? (sections.at(-1)?.id ?? current) : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    setEntries(found);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav
      ref={ref}
      aria-label="On this page"
      className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto"
    >
      {entries.length > 1 && (
        <>
          <h2 className="px-2.5 pb-1 text-[0.6875rem] font-medium tracking-wide text-muted uppercase">
            On this page
          </h2>

          <ul className="space-y-0.5">
            {entries.map((entry) => {
              const isCurrent = entry.id === currentId;
              return (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    aria-current={isCurrent ? "location" : undefined}
                    className={`block rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-[color,background-color] duration-[var(--duration-fast)] ${
                      isCurrent
                        ? "bg-default font-medium text-foreground"
                        : "text-muted hover:bg-default/60 hover:text-foreground"
                    }`}
                  >
                    {entry.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </nav>
  );
}
