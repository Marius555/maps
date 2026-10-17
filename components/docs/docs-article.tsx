import { DocsEyebrow } from "./docs-eyebrow";
import { DocsPager } from "./docs-pager";
import { DocsToc } from "./docs-toc";

/**
 * One guide: its title, its one-line summary, and the prose under them.
 *
 * There is no `@tailwindcss/typography` in this project and none should be added
 * — Tailwind v4 here is CSS-first with no config file (CLAUDE.md §3). So the
 * body's element styles are descendant variants set once, in one place, rather
 * than a class repeated on every paragraph in every guide.
 *
 * **Running text is `--docs-prose`, a step back from `--foreground`** (owner,
 * 2026-10-18). It used to be full foreground, chosen because `--muted` is under
 * AA for long reading — and in dark mode that made every guide a wall of
 * near-white. `--docs-prose` sits between the two at ~8.5–9:1 in both themes.
 * Headings, `<strong>`, link text and inline code stay foreground: they are what
 * the eye scans by, and the contrast between them and the prose is the point.
 * Appwrite's docs read the same way, which is where this was taken from.
 *
 * **A measure cap, and the width beside it spent on "On this page".** The body
 * once filled the column, and on a laptop that was a 150-character line nobody
 * can follow back to its start. `44rem` holds 15px prose near 85 characters;
 * from `xl` the room it frees is `DocsToc`'s column. The column is reserved
 * whether or not the list has filled in, so nothing moves on hydration. It sits
 * outside the body's descendant variants on purpose — they would underline and
 * bullet its links.
 */
export function DocsArticle({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-1 gap-12">
      <div className="min-w-0 max-w-[44rem] flex-1">
        <header className="space-y-3 pb-10">
          <DocsEyebrow />
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="text-pretty text-base/7 text-docs-prose sm:text-[1.0625rem]/7">
            {summary}
          </p>
        </header>

        <div
          className={[
            "space-y-12 text-[0.9375rem]/7 text-docs-prose",
            "[&_p]:text-pretty",
            "[&_strong]:font-medium [&_strong]:text-foreground",
            "[&_a]:text-foreground [&_a]:underline [&_a]:decoration-muted/50 [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground",
            "[&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-muted",
            // Inline code only: a `CodeBlock` draws its own `<code>` on its own ground.
            "[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:border [&_:not(pre)>code]:border-border [&_:not(pre)>code]:bg-default/60 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.8125rem] [&_:not(pre)>code]:text-foreground",
          ].join(" ")}
        >
          {children}
        </div>

        <DocsPager />
      </div>

      <aside className="hidden w-52 shrink-0 xl:block">
        <DocsToc />
      </aside>
    </article>
  );
}
