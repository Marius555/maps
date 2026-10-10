import { DocsToc } from "./docs-toc";

/**
 * One guide: its title, its one-line summary, and the prose under them.
 *
 * There is no `@tailwindcss/typography` in this project and none should be added
 * — Tailwind v4 here is CSS-first with no config file (CLAUDE.md §3). So the
 * body's element styles are descendant variants set once, in one place, rather
 * than a class repeated on every paragraph in every guide.
 *
 * **Body copy is `text-foreground`, not `text-muted`.** `--muted` is `L 50%` on
 * an `L 97.5%` page, which lands near 4.2:1 — fine for a caption or a count, and
 * under AA for something somebody is going to read for five minutes. Muted is
 * kept for the summary line, which is short and set larger.
 *
 * **A measure cap, and the width beside it spent on "On this page".** The body
 * once filled the column, and at `text-sm` on a laptop that is a 150-character
 * line nobody can follow back to its start. `max-w-3xl` holds prose near 75
 * characters; from `xl` the room it frees is `DocsToc`'s column, so the page is
 * still full and the reader has a map of the guide beside it. The column is
 * reserved whether or not the list has filled in, so nothing moves on hydration.
 * It sits outside the body's descendant variants on purpose — they would
 * underline and bullet its links.
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
    <article className="flex min-w-0 flex-1 gap-10">
      <div className="min-w-0 max-w-3xl flex-1">
        <header className="space-y-3 pb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="text-pretty text-muted">{summary}</p>
        </header>

        <div
          className={[
            "space-y-12 text-sm/6 text-foreground",
            "[&_p]:text-pretty",
            "[&_strong]:font-medium [&_strong]:text-foreground",
            "[&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-accent",
            "[&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-muted",
            // Inline code only: a `CodeBlock` draws its own `<code>` on its own ground.
            "[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:bg-default [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-xs",
          ].join(" ")}
        >
          {children}
        </div>
      </div>

      <aside className="hidden w-48 shrink-0 xl:block">
        <DocsToc />
      </aside>
    </article>
  );
}
