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
 * **No measure cap.** The body used to stop at `max-w-2xl`, which left half the
 * column beside the nav rail empty on a laptop. It fills the column now; tables
 * and callouts are what benefit, and they carry most of each guide.
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
    <article className="min-w-0 flex-1">
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
          "[&_code]:rounded-md [&_code]:bg-default [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
        ].join(" ")}
      >
        {children}
      </div>
    </article>
  );
}
